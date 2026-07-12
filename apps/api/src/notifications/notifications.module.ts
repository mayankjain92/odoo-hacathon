import { Module, Global } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { ActivityLogService } from "./activity-log.service";
import { ActivityLogController } from "./activity-log.controller";

@Global()
@Module({
  controllers: [NotificationsController, ActivityLogController],
  providers: [NotificationsService, ActivityLogService],
  exports: [NotificationsService, ActivityLogService],
})
export class NotificationsModule {}
