import { HttpStatus, Injectable } from "@nestjs/common";
import {
  MaintenancePriority,
  MaintenanceStatus,
  AssetStatus,
  ErrorCode,
  buildPaginationMeta,
  type PaginatedResponse,
} from "@assetflow/shared";
import { Prisma } from "../generated/prisma/client";
import { ApiException } from "../common/errors/api.exception";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateMaintenanceDto } from "./dto/create-maintenance.dto";
import type { UpdateMaintenanceStatusDto } from "./dto/update-maintenance-status.dto";
import type { MaintenanceQueryDto } from "./dto/maintenance-query.dto";

const maintenanceInclude = {
  asset: { select: { id: true, name: true, assetTag: true, status: true } },
  requester: { select: { id: true, name: true, email: true } },
} satisfies Prisma.MaintenanceRequestInclude;

type MaintenanceWithRelations = Prisma.MaintenanceRequestGetPayload<{
  include: typeof maintenanceInclude;
}>;

const ALLOWED_TRANSITIONS: Record<MaintenanceStatus, readonly MaintenanceStatus[]> = {
  [MaintenanceStatus.Pending]: [MaintenanceStatus.Approved, MaintenanceStatus.Rejected],
  [MaintenanceStatus.Approved]: [
    MaintenanceStatus.TechnicianAssigned,
    MaintenanceStatus.InProgress,
    MaintenanceStatus.Resolved,
  ],
  [MaintenanceStatus.TechnicianAssigned]: [MaintenanceStatus.InProgress, MaintenanceStatus.Resolved],
  [MaintenanceStatus.InProgress]: [MaintenanceStatus.Resolved],
  [MaintenanceStatus.Rejected]: [],
  [MaintenanceStatus.Resolved]: [],
};

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(dto: CreateMaintenanceDto, actorId: string) {
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

    const request = await this.prisma.maintenanceRequest.create({
      data: {
        assetId: dto.assetId,
        requesterId: actorId,
        description: dto.description,
        priority: dto.priority ?? MaintenancePriority.Medium,
        photoUrl: dto.photoUrl || null,
        status: MaintenanceStatus.Pending,
      },
      include: maintenanceInclude,
    });

    await this.logActivity(actorId, "maintenance.request", "Asset", dto.assetId, {
      requestId: request.id,
    });

    return this.toMaintenanceView(request);
  }

  async updateStatus(
    id: string,
    dto: UpdateMaintenanceStatusDto,
    actorId: string,
  ) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
    });
    if (!request) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Maintenance request not found",
        HttpStatus.NOT_FOUND,
      );
    }

    const fromStatus = request.status;
    const toStatus = dto.status;

    if (fromStatus === toStatus) {
      return this.findOne(id);
    }

    const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new ApiException(
        ErrorCode.INVALID_STATUS_TRANSITION,
        `Cannot transition maintenance request from ${fromStatus} to ${toStatus}`,
        HttpStatus.CONFLICT,
        { fromStatus, toStatus, allowed },
      );
    }

    const updatedRequest = await this.prisma.$transaction(async (tx) => {
      // 1. If approved, change Asset status to UnderMaintenance
      if (toStatus === MaintenanceStatus.Approved) {
        await tx.asset.update({
          where: { id: request.assetId },
          data: { status: AssetStatus.UnderMaintenance },
        });
      }

      // 2. If resolved, revert Asset status to Allocated (if active allocation exists) or Available
      if (toStatus === MaintenanceStatus.Resolved) {
        const activeAlloc = await tx.allocation.findFirst({
          where: { assetId: request.assetId, active: true },
        });

        const nextAssetStatus = activeAlloc
          ? AssetStatus.Allocated
          : AssetStatus.Available;

        await tx.asset.update({
          where: { id: request.assetId },
          data: { status: nextAssetStatus },
        });
      }

      // 3. Update the request
      return tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: toStatus,
          technician: dto.technician !== undefined ? dto.technician : request.technician,
        },
        include: maintenanceInclude,
      });
    });

    await this.logActivity(
      actorId,
      "maintenance.update_status",
      "Asset",
      request.assetId,
      {
        requestId: request.id,
        fromStatus,
        toStatus,
        technician: dto.technician,
      },
    );

    return this.toMaintenanceView(updatedRequest);
  }

  async findAll(
    query: MaintenanceQueryDto,
  ): Promise<PaginatedResponse<ReturnType<MaintenanceService["toMaintenanceView"]>>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.MaintenanceRequestWhereInput = {};
    if (query.assetId) where.assetId = query.assetId;
    if (query.status) where.status = query.status as MaintenanceStatus;
    if (query.priority) where.priority = query.priority as MaintenancePriority;
    if (query.requesterId) where.requesterId = query.requesterId;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.maintenanceRequest.count({ where }),
      this.prisma.maintenanceRequest.findMany({
        where,
        include: maintenanceInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: rows.map((row) => this.toMaintenanceView(row)),
      meta: buildPaginationMeta(page, pageSize, total),
    };
  }

  async findOne(id: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      include: maintenanceInclude,
    });
    if (!request) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Maintenance request not found",
        HttpStatus.NOT_FOUND,
      );
    }
    return this.toMaintenanceView(request);
  }

  private toMaintenanceView(request: MaintenanceWithRelations) {
    return {
      id: request.id,
      assetId: request.assetId,
      requesterId: request.requesterId,
      description: request.description,
      priority: request.priority,
      status: request.status,
      photoUrl: request.photoUrl,
      technician: request.technician,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      asset: request.asset,
      requester: request.requester,
    };
  }

  private async logActivity(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ) {
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
