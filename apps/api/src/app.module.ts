import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { CloudinaryModule } from "./common/cloudinary/cloudinary.module";
import { AuthModule } from "./auth/auth.module";
import { OrgModule } from "./org/org.module";
import { AssetsModule } from "./assets/assets.module";
import { AllocationsModule } from "./allocations/allocations.module";
import { BookingsModule } from "./bookings/bookings.module";
import { MaintenanceModule } from "./maintenance/maintenance.module";
import { AuditsModule } from "./audits/audits.module";
import { ReportsModule } from "./reports/reports.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { JobsModule } from "./jobs/jobs.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CloudinaryModule,
    HealthModule,
    AuthModule,
    OrgModule,
    AssetsModule,
    AllocationsModule,
    BookingsModule,
    MaintenanceModule,
    AuditsModule,
    ReportsModule,
    NotificationsModule,
    JobsModule,
  ],
})
export class AppModule {}
