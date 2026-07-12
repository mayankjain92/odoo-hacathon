import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { BookingStatus } from "../generated/prisma/client";

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const bookings = await this.prisma.booking.findMany({
      orderBy: { startsAt: "asc" },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            assetTag: true,
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
    return { data: bookings };
  }

  async create(userId: string, dto: CreateBookingDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (endsAt <= startsAt) {
      throw new BadRequestException("endsAt must be after startsAt");
    }

    const asset = await this.prisma.asset.findUnique({
      where: { id: dto.assetId },
    });

    if (!asset) {
      throw new BadRequestException("Asset not found");
    }

    // We removed the isSharedBookable check from the frontend dropdown as requested.
    // However, if the business logic requires ONLY bookable assets to be booked, 
    // we would uncomment this. Since the user wanted all assets to be bookable 
    // for this demo, we'll allow it.
    // if (!asset.isSharedBookable) {
    //   throw new BadRequestException("This asset is not available for shared booking");
    // }

    // Check for overlap
    const overlapping = await this.prisma.booking.findFirst({
      where: {
        assetId: dto.assetId,
        status: { notIn: [BookingStatus.Cancelled, BookingStatus.Completed] },
        OR: [
          {
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          }
        ]
      },
    });

    if (overlapping) {
      throw new BadRequestException("The asset is already reserved for this duration.");
    }

    const booking = await this.prisma.booking.create({
      data: {
        assetId: dto.assetId,
        userId,
        startsAt,
        endsAt,
        purpose: dto.purpose,
        status: BookingStatus.Upcoming,
      },
    });

    return booking;
  }
}
