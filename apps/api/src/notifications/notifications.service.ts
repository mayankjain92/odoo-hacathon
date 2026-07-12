import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationQueryDto } from "./dto/notification.dto";
import { NotificationType, ErrorCode } from "@assetflow/shared";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserNotifications(userId: string, query: NotificationQueryDto) {
    const { page = 1, pageSize = 20, unreadOnly } = query;

    const where = {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
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

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.NOT_FOUND,
        message: "Notification not found",
      });
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  }

  async clearAll(userId: string) {
    return this.prisma.notification.deleteMany({
      where: { userId },
    });
  }

  async createNotification(
    userId: string,
    title: string,
    body: string,
    type: NotificationType,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        title,
        body,
        type,
      },
    });
  }
}
