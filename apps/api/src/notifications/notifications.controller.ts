import { Controller, Get, Patch, Param, Query, UseGuards, Req } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { NotificationQueryDto } from "./dto/notification.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Request } from "express";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "Get user notifications" })
  async getNotifications(
    @Req() req: Request,
    @Query() query: NotificationQueryDto,
  ) {
    const userId = (req.user as any).userId;
    return this.notificationsService.getUserNotifications(userId, query);
  }

  @Patch("read-all")
  @ApiOperation({ summary: "Mark all unread notifications as read" })
  async markAllAsRead(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.notificationsService.markAllAsRead(userId);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark a notification as read" })
  async markAsRead(@Req() req: Request, @Param("id") id: string) {
    const userId = (req.user as any).userId;
    return this.notificationsService.markAsRead(userId, id);
  }
}
