import { Controller, Get, Patch, Delete, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { NotificationQueryDto } from "./dto/notification.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUserView } from "../auth/types/auth.types";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "Get user notifications" })
  async getNotifications(
    @CurrentUser() user: AuthUserView,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationsService.getUserNotifications(user.id, query);
  }

  @Patch("read-all")
  @ApiOperation({ summary: "Mark all unread notifications as read" })
  async markAllAsRead(@CurrentUser() user: AuthUserView) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Delete()
  @ApiOperation({ summary: "Clear (delete) all notifications for the user" })
  async clearAll(@CurrentUser() user: AuthUserView) {
    return this.notificationsService.clearAll(user.id);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark a notification as read" })
  async markAsRead(@CurrentUser() user: AuthUserView, @Param("id") id: string) {
    return this.notificationsService.markAsRead(user.id, id);
  }
}
