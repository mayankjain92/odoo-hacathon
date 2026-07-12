import { Injectable, HttpStatus } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ApiException } from "../common/errors/api.exception";
import { ErrorCode, BookingStatus, AssetStatus, Role } from "@assetflow/shared";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { RescheduleBookingDto } from "./dto/reschedule-booking.dto";
import { BookingsQueryDto } from "./dto/bookings-query.dto";

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // CREATE BOOKING
  // ==========================================

  async createBooking(dto: CreateBookingDto, actorId: string) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    // 1. Validate time range
    if (endsAt <= startsAt) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Booking end time must be after start time",
        HttpStatus.BAD_REQUEST,
      );
    }

    // 2. Fetch asset and validate it's bookable
    const asset = await this.prisma.asset.findUnique({
      where: { id: dto.assetId },
    });

    if (!asset) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Asset not found",
        HttpStatus.NOT_FOUND,
      );
    }

    if (!asset.isSharedBookable) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "This asset is not marked as a bookable/shared resource. Only assets with isSharedBookable=true can be booked.",
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3. Check asset lifecycle — allow booking for Available and Allocated (shared) resources
    const unbookableStatuses: string[] = [
      AssetStatus.UnderMaintenance,
      AssetStatus.Lost,
      AssetStatus.Retired,
      AssetStatus.Disposed,
    ];
    if (unbookableStatuses.includes(asset.status)) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        `Asset is not available for booking (current status: ${asset.status})`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // 4. Overlap check + create inside a single transaction, guarded by a
    //    per-asset advisory lock so concurrent requests cannot both pass the
    //    check and double-book (TOCTOU). The lock auto-releases at commit.
    //    Rule: end time of A == start time of B is allowed (adjacent OK)
    //    Overlap condition: existingStart < newEnd AND existingEnd > newStart
    return this.prisma.$transaction(async (tx) => {
      await this.lockAsset(tx, dto.assetId);

      const overlapping = await tx.booking.findFirst({
        where: {
          assetId: dto.assetId,
          status: { not: BookingStatus.Cancelled as any },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      if (overlapping) {
        throw new ApiException(
          ErrorCode.BOOKING_OVERLAP,
          "The requested time slot overlaps with an existing booking",
          HttpStatus.CONFLICT,
          {
            conflictingBooking: {
              id: overlapping.id,
              startsAt: overlapping.startsAt,
              endsAt: overlapping.endsAt,
              bookedBy: overlapping.user,
            },
          },
        );
      }

      const booking = await tx.booking.create({
        data: {
          assetId: dto.assetId,
          userId: actorId,
          startsAt,
          endsAt,
          purpose: dto.purpose || null,
          status: BookingStatus.Upcoming as any,
        },
        include: {
          asset: { select: { id: true, name: true, assetTag: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      // Optionally mark asset as Reserved if it's currently Available
      if (asset.status === AssetStatus.Available) {
        await tx.asset.update({
          where: { id: dto.assetId },
          data: { status: AssetStatus.Reserved },
        });
      }

      // Activity log
      await tx.activityLog.create({
        data: {
          actorId,
          action: "booking.create",
          entityType: "Booking",
          entityId: booking.id,
          metadata: {
            assetId: dto.assetId,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            purpose: dto.purpose || null,
          },
        },
      });

      return booking;
    });
  }

  // ==========================================
  // CANCEL BOOKING
  // ==========================================

  async cancelBooking(bookingId: string, actorId: string, actorRole: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        asset: true,
      },
    });

    if (!booking) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Booking not found",
        HttpStatus.NOT_FOUND,
      );
    }

    if (booking.status === BookingStatus.Cancelled) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Booking is already cancelled",
        HttpStatus.BAD_REQUEST,
      );
    }

    if (booking.status === BookingStatus.Completed) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Cannot cancel a completed booking",
        HttpStatus.BAD_REQUEST,
      );
    }

    // RBAC: only the booker, Admin, or AssetManager can cancel
    if (
      booking.userId !== actorId &&
      actorRole !== Role.Admin &&
      actorRole !== Role.AssetManager
    ) {
      throw new ApiException(
        ErrorCode.FORBIDDEN_ROLE,
        "You can only cancel your own bookings",
        HttpStatus.FORBIDDEN,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.Cancelled as any },
        include: {
          asset: { select: { id: true, name: true, assetTag: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      // If no other active bookings remain for this asset, reset status to Available
      await this.resetAssetStatusIfNoActiveBookings(tx, booking.assetId);

      // Activity log
      await tx.activityLog.create({
        data: {
          actorId,
          action: "booking.cancel",
          entityType: "Booking",
          entityId: bookingId,
          metadata: {
            assetId: booking.assetId,
            cancelledBy: actorId,
          },
        },
      });

      // Notify the booker if someone else cancelled it
      if (booking.userId !== actorId) {
        await tx.notification.create({
          data: {
            userId: booking.userId,
            title: "Booking Cancelled",
            body: `Your booking for "${booking.asset.name}" (${booking.asset.assetTag}) from ${booking.startsAt.toISOString()} to ${booking.endsAt.toISOString()} has been cancelled by an administrator.`,
            type: "BookingCancelled",
          },
        });
      }

      return updated;
    });
  }

  // ==========================================
  // RESCHEDULE BOOKING
  // ==========================================

  async rescheduleBooking(
    bookingId: string,
    dto: RescheduleBookingDto,
    actorId: string,
    actorRole: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Booking not found",
        HttpStatus.NOT_FOUND,
      );
    }

    // Can only reschedule Upcoming bookings
    if (booking.status !== BookingStatus.Upcoming) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        `Cannot reschedule a booking with status "${booking.status}". Only Upcoming bookings can be rescheduled.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // RBAC: only the booker, Admin, or AssetManager can reschedule
    if (
      booking.userId !== actorId &&
      actorRole !== Role.Admin &&
      actorRole !== Role.AssetManager
    ) {
      throw new ApiException(
        ErrorCode.FORBIDDEN_ROLE,
        "You can only reschedule your own bookings",
        HttpStatus.FORBIDDEN,
      );
    }

    const newStartsAt = dto.startsAt ? new Date(dto.startsAt) : booking.startsAt;
    const newEndsAt = dto.endsAt ? new Date(dto.endsAt) : booking.endsAt;

    if (newEndsAt <= newStartsAt) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Booking end time must be after start time",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Overlap check (exclude current booking) + update inside a single
    // transaction, guarded by a per-asset advisory lock (see createBooking).
    return this.prisma.$transaction(async (tx) => {
      await this.lockAsset(tx, booking.assetId);

      const overlapping = await tx.booking.findFirst({
        where: {
          assetId: booking.assetId,
          id: { not: bookingId },
          status: { not: BookingStatus.Cancelled as any },
          startsAt: { lt: newEndsAt },
          endsAt: { gt: newStartsAt },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      if (overlapping) {
        throw new ApiException(
          ErrorCode.BOOKING_OVERLAP,
          "The new time slot overlaps with an existing booking",
          HttpStatus.CONFLICT,
          {
            conflictingBooking: {
              id: overlapping.id,
              startsAt: overlapping.startsAt,
              endsAt: overlapping.endsAt,
              bookedBy: overlapping.user,
            },
          },
        );
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          startsAt: newStartsAt,
          endsAt: newEndsAt,
          purpose: dto.purpose !== undefined ? dto.purpose : undefined,
        },
        include: {
          asset: { select: { id: true, name: true, assetTag: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.activityLog.create({
        data: {
          actorId,
          action: "booking.reschedule",
          entityType: "Booking",
          entityId: bookingId,
          metadata: {
            assetId: booking.assetId,
            oldStartsAt: booking.startsAt.toISOString(),
            oldEndsAt: booking.endsAt.toISOString(),
            newStartsAt: newStartsAt.toISOString(),
            newEndsAt: newEndsAt.toISOString(),
          },
        },
      });

      return updated;
    });
  }

  // ==========================================
  // LIST BOOKINGS (paginated)
  // ==========================================

  async findAll(query: BookingsQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.assetId) {
      where.assetId = query.assetId;
    }
    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.status) {
      where.status = query.status;
    }

    // Date range filters
    if (query.from || query.to) {
      where.startsAt = {};
      if (query.from) {
        where.startsAt.gte = new Date(query.from);
      }
      if (query.to) {
        where.startsAt.lte = new Date(query.to);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { startsAt: "asc" },
        include: {
          asset: { select: { id: true, name: true, assetTag: true, location: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  // ==========================================
  // GET SINGLE BOOKING
  // ==========================================

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            assetTag: true,
            location: true,
            category: { select: { id: true, name: true } },
          },
        },
        user: { select: { id: true, name: true, email: true, departmentId: true } },
      },
    });

    if (!booking) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Booking not found",
        HttpStatus.NOT_FOUND,
      );
    }

    return booking;
  }

  // ==========================================
  // GET BOOKINGS FOR A SPECIFIC ASSET (calendar view)
  // ==========================================

  async findByAsset(assetId: string, from?: string, to?: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, name: true, assetTag: true, isSharedBookable: true },
    });

    if (!asset) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Asset not found",
        HttpStatus.NOT_FOUND,
      );
    }

    const where: any = {
      assetId,
      status: { not: BookingStatus.Cancelled as any },
    };

    if (from || to) {
      where.startsAt = {};
      if (from) where.startsAt.gte = new Date(from);
      if (to) where.startsAt.lte = new Date(to);
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      orderBy: { startsAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      asset,
      bookings,
    };
  }

  // ==========================================
  // GET MY BOOKINGS (current user)
  // ==========================================

  async findMyBookings(userId: string, query: BookingsQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {
      userId,
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.assetId) {
      where.assetId = query.assetId;
    }
    if (query.from || query.to) {
      where.startsAt = {};
      if (query.from) where.startsAt.gte = new Date(query.from);
      if (query.to) where.startsAt.lte = new Date(query.to);
    }

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { startsAt: "asc" },
        include: {
          asset: { select: { id: true, name: true, assetTag: true, location: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      meta: { page, pageSize, total, totalPages },
    };
  }

  // ==========================================
  // COMPLETE BOOKING (manual or job-triggered)
  // ==========================================

  async completeBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Booking not found",
        HttpStatus.NOT_FOUND,
      );
    }

    if (booking.status === BookingStatus.Cancelled || booking.status === BookingStatus.Completed) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        `Booking is already ${booking.status}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.Completed as any },
        include: {
          asset: { select: { id: true, name: true, assetTag: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      // Reset asset status if no other active bookings
      await this.resetAssetStatusIfNoActiveBookings(tx, booking.assetId);

      await tx.activityLog.create({
        data: {
          action: "booking.complete",
          entityType: "Booking",
          entityId: bookingId,
          metadata: {
            assetId: booking.assetId,
          },
        },
      });

      return updated;
    });
  }

  // ==========================================
  // START BOOKING (transition Upcoming → Ongoing)
  // ==========================================

  async startBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Booking not found",
        HttpStatus.NOT_FOUND,
      );
    }

    if (booking.status !== BookingStatus.Upcoming) {
      throw new ApiException(
        ErrorCode.INVALID_STATUS_TRANSITION,
        `Cannot start a booking with status "${booking.status}". Only Upcoming bookings can be started.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.Ongoing as any },
      include: {
        asset: { select: { id: true, name: true, assetTag: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // ==========================================
  // BOOKING STATUS TRANSITION JOB
  // (Called by BullMQ worker to auto-transition statuses)
  // ==========================================

  async processBookingStatusTransitions() {
    const now = new Date();

    // 1. Transition Upcoming → Ongoing (start time has passed)
    const toStart = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.Upcoming as any,
        startsAt: { lte: now },
      },
    });

    let startedCount = 0;
    for (const booking of toStart) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.Ongoing as any },
      });
      startedCount++;
    }

    // 2. Transition Ongoing → Completed (end time has passed)
    const toComplete = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.Ongoing as any,
        endsAt: { lte: now },
      },
      include: { asset: true },
    });

    let completedCount = 0;
    for (const booking of toComplete) {
      await this.prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.Completed as any },
        });

        await this.resetAssetStatusIfNoActiveBookings(tx, booking.assetId);
      });
      completedCount++;
    }

    return { startedCount, completedCount };
  }

  // ==========================================
  // BOOKING REMINDERS
  // (Called by BullMQ worker to send reminders before slot start)
  // ==========================================

  async sendBookingReminders(minutesBefore: number = 15) {
    const now = new Date();
    const reminderWindow = new Date(now.getTime() + minutesBefore * 60 * 1000);

    const upcomingBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.Upcoming as any,
        startsAt: {
          gt: now,
          lte: reminderWindow,
        },
      },
      include: {
        asset: { select: { name: true, assetTag: true, location: true } },
        user: { select: { id: true, name: true } },
      },
    });

    let sentCount = 0;
    for (const booking of upcomingBookings) {
      // Check if reminder was already sent (avoid duplicates)
      const existingNotification = await this.prisma.notification.findFirst({
        where: {
          userId: booking.userId,
          type: "BookingReminder",
          createdAt: { gte: new Date(now.getTime() - 30 * 60 * 1000) }, // within last 30 min
          body: { contains: booking.id },
        },
      });

      if (!existingNotification) {
        await this.prisma.notification.create({
          data: {
            userId: booking.userId,
            title: "Upcoming Booking Reminder",
            body: `Your booking for "${booking.asset.name}" (${booking.asset.assetTag})${booking.asset.location ? ` at ${booking.asset.location}` : ""} starts at ${booking.startsAt.toLocaleTimeString()}. Booking ID: ${booking.id}`,
            type: "BookingReminder",
          },
        });
        sentCount++;
      }
    }

    return { sentCount };
  }

  // ==========================================
  // HELPER: Reset asset status when no active bookings remain
  // ==========================================

  /**
   * Acquire a transaction-scoped Postgres advisory lock for an asset so that
   * concurrent booking operations on the same asset are serialized, preventing
   * TOCTOU double-booking. Auto-released when the transaction commits/rolls back.
   * ponytail: advisory lock avoids a gist EXCLUDE constraint (no migration/extension).
   * hashtext collisions only reduce concurrency for unrelated assets, never correctness.
   */
  private async lockAsset(tx: any, assetId: string): Promise<void> {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${assetId}))`;
  }

  private async resetAssetStatusIfNoActiveBookings(tx: any, assetId: string) {
    const activeBookings = await tx.booking.count({
      where: {
        assetId,
        status: {
          in: [BookingStatus.Upcoming, BookingStatus.Ongoing],
        },
      },
    });

    if (activeBookings === 0) {
      // Only reset if currently Reserved (don't override Allocated, UnderMaintenance, etc.)
      const asset = await tx.asset.findUnique({
        where: { id: assetId },
        select: { status: true },
      });

      if (asset && asset.status === AssetStatus.Reserved) {
        await tx.asset.update({
          where: { id: assetId },
          data: { status: AssetStatus.Available },
        });
      }
    }
  }
}
