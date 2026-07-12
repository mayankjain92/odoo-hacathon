import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ApiException } from "../common/errors/api.exception";
import { AuditCycleStatus, AuditItemResult, ErrorCode, EntityStatus, Role, NotificationType, buildPaginationMeta, type PaginatedResponse } from "@assetflow/shared";
import type { CreateAuditCycleDto } from "./dto/create-audit-cycle.dto";
import type { AuditCycleQueryDto } from "./dto/audit-cycle-query.dto";
import type { RecordAuditItemDto } from "./dto/record-audit-item.dto";
import type { UpdateAuditStatusDto } from "./dto/update-audit-status.dto";

const cycleInclude = {
  department: { select: { id: true, name: true } },
  auditors: {
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  },
  _count: {
    select: { items: true },
  },
} satisfies Prisma.AuditCycleInclude;

const cycleDetailInclude = {
  department: { select: { id: true, name: true } },
  auditors: {
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  },
  items: {
    include: {
      asset: { select: { id: true, name: true, assetTag: true, categoryId: true, status: true, location: true } },
    },
    orderBy: { updatedAt: "desc" },
  },
} satisfies Prisma.AuditCycleInclude;

@Injectable()
export class AuditsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCycle(dto: CreateAuditCycleDto, actorId: string) {
    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      if (!dept) {
        throw new ApiException(ErrorCode.NOT_FOUND, "Department not found", HttpStatus.NOT_FOUND);
      }
    }

    const cycle = await this.prisma.auditCycle.create({
      data: {
        name: dto.name,
        departmentId: dto.departmentId ?? null,
        location: dto.location ?? null,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        status: AuditCycleStatus.Open,
        auditors: {
          create: dto.auditorIds?.map((userId) => ({
            userId,
          })) ?? [],
        },
      },
      include: cycleInclude,
    });

    await this.logActivity(actorId, "audit.cycle_created", "AuditCycle", cycle.id, { name: cycle.name });
    return cycle;
  }

  async findAll(query: AuditCycleQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.AuditCycleWhereInput = {};
    if (query.status) where.status = query.status as AuditCycleStatus;
    if (query.departmentId) where.departmentId = query.departmentId;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditCycle.count({ where }),
      this.prisma.auditCycle.findMany({
        where,
        include: cycleInclude,
        orderBy: { startsAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: rows,
      meta: buildPaginationMeta(page, pageSize, total),
    };
  }

  async findOne(id: string) {
    const cycle = await this.prisma.auditCycle.findUnique({
      where: { id },
      include: cycleDetailInclude,
    });

    if (!cycle) {
      throw new ApiException(ErrorCode.NOT_FOUND, "Audit cycle not found", HttpStatus.NOT_FOUND);
    }

    return cycle;
  }

  async updateStatus(id: string, dto: UpdateAuditStatusDto, actorId: string) {
    const cycle = await this.prisma.auditCycle.findUnique({ where: { id } });
    if (!cycle) {
      throw new ApiException(ErrorCode.NOT_FOUND, "Audit cycle not found", HttpStatus.NOT_FOUND);
    }

    const fromStatus = cycle.status;
    const toStatus = dto.status;

    if (fromStatus === toStatus) return this.findOne(id);

    const allowedTransitions: Record<string, string[]> = {
      [AuditCycleStatus.Open]: [AuditCycleStatus.InProgress],
      [AuditCycleStatus.InProgress]: [AuditCycleStatus.Closed],
      [AuditCycleStatus.Closed]: [],
    };

    const allowed = allowedTransitions[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new ApiException(
        ErrorCode.INVALID_STATUS_TRANSITION,
        `Cannot transition audit from ${fromStatus} to ${toStatus}`,
        HttpStatus.CONFLICT,
        { fromStatus, toStatus }
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateData: Prisma.AuditCycleUpdateInput = { status: toStatus };
      if (toStatus === AuditCycleStatus.Closed) {
        updateData.lockedAt = new Date();
      }

      const cycleRes = await tx.auditCycle.update({
        where: { id },
        data: updateData,
        include: cycleInclude,
      });

      if (toStatus === AuditCycleStatus.Closed) {
        const missingItems = await tx.auditItem.findMany({
          where: { cycleId: id, result: "Missing" }, // AuditItemResult.Missing
        });
        
        if (missingItems.length > 0) {
          const assetIds = missingItems.map(item => item.assetId);
          await tx.asset.updateMany({
            where: { id: { in: assetIds } },
            data: { status: "Lost" }, // AssetStatus.Lost
          });
        }
      }

      return cycleRes;
    });

    await this.logActivity(actorId, "audit.status_updated", "AuditCycle", cycle.id, { fromStatus, toStatus });
    return updated;
  }

  async recordItem(id: string, dto: RecordAuditItemDto, actorId: string) {
    const cycle = await this.prisma.auditCycle.findUnique({
      where: { id },
      include: { auditors: true },
    });

    if (!cycle) {
      throw new ApiException(ErrorCode.NOT_FOUND, "Audit cycle not found", HttpStatus.NOT_FOUND);
    }
    if (cycle.status !== AuditCycleStatus.InProgress) {
      throw new ApiException(
        ErrorCode.INVALID_STATUS_TRANSITION,
        "Can only record items when audit is In Progress",
        HttpStatus.CONFLICT,
      );
    }

    const asset = await this.prisma.asset.findUnique({
      where: { assetTag: dto.assetTag.trim().toUpperCase() },
    });

    if (!asset) {
      throw new ApiException(ErrorCode.NOT_FOUND, "Asset not found by tag", HttpStatus.NOT_FOUND);
    }

    // Verify scope (if department or location is specified)
    if (cycle.departmentId && asset.departmentId !== cycle.departmentId) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Asset does not belong to the audited department",
        HttpStatus.BAD_REQUEST
      );
    }
    if (cycle.location && asset.location?.toLowerCase() !== cycle.location.toLowerCase()) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Asset is not in the audited location",
        HttpStatus.BAD_REQUEST
      );
    }

    const item = await this.prisma.auditItem.upsert({
      where: {
        cycleId_assetId: {
          cycleId: id,
          assetId: asset.id,
        },
      },
      update: {
        result: dto.result,
        notes: dto.notes ?? null,
      },
      create: {
        cycleId: id,
        assetId: asset.id,
        result: dto.result,
        notes: dto.notes ?? null,
      },
    });

    await this.logActivity(actorId, "audit.item_recorded", "AuditCycle", cycle.id, {
      assetId: asset.id,
      result: dto.result,
    });

    // Flag a discrepancy: notify admins/asset managers when an item is Missing or Damaged
    if (
      dto.result === AuditItemResult.Missing ||
      dto.result === AuditItemResult.Damaged
    ) {
      const managers = await this.prisma.user.findMany({
        where: {
          role: { in: [Role.Admin, Role.AssetManager] },
          status: EntityStatus.Active,
        },
        select: { id: true },
      });
      if (managers.length > 0) {
        await this.prisma.notification.createMany({
          data: managers.map((m) => ({
            userId: m.id,
            title: "Audit Discrepancy Flagged",
            body: `Asset "${asset.name}" (${asset.assetTag}) was flagged as ${dto.result} in audit cycle "${cycle.name}".`,
            type: NotificationType.AuditDiscrepancy,
          })),
        });
      }
    }

    return item;
  }

  private async logActivity(actorId: string, action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>) {
    await this.prisma.activityLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }
}
