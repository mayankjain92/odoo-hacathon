import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogQueryDto } from "./dto/activity-log.dto";
import { ActivityAction, EntityType } from "@assetflow/shared";

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async getLogs(query: ActivityLogQueryDto) {
    const { page = 1, pageSize = 20, entityType, entityId, actorId, action } = query;

    const where = {
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(actorId && { actorId }),
      ...(action && { action }),
    };

    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async logAction(
    action: ActivityAction,
    entityType: EntityType,
    entityId?: string,
    actorId?: string,
    metadata?: any,
  ) {
    return this.prisma.activityLog.create({
      data: {
        action,
        entityType,
        entityId,
        actorId,
        metadata: metadata ? metadata : undefined,
      },
    });
  }
}
