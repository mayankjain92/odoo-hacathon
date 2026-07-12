import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUserView } from "../auth/types/auth.types";
import { Role } from "@assetflow/shared";
import { BookingsService } from "./bookings.service";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { RescheduleBookingDto } from "./dto/reschedule-booking.dto";
import { BookingsQueryDto } from "./dto/bookings-query.dto";

@ApiTags("bookings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("bookings")
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // ─── Create a booking ────────────────────────────────────────────
  @Post()
  @ApiOperation({ summary: "Book a shared resource for a time slot" })
  createBooking(
    @Body() dto: CreateBookingDto,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.bookingsService.createBooking(dto, actor.id);
  }

  // ─── Cancel a booking ────────────────────────────────────────────
  @Post(":id/cancel")
  @ApiOperation({ summary: "Cancel a booking" })
  cancelBooking(
    @Param("id") id: string,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.bookingsService.cancelBooking(id, actor.id, actor.role);
  }

  // ─── Reschedule a booking ────────────────────────────────────────
  @Put(":id/reschedule")
  @ApiOperation({ summary: "Reschedule an upcoming booking to a new time slot" })
  rescheduleBooking(
    @Param("id") id: string,
    @Body() dto: RescheduleBookingDto,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.bookingsService.rescheduleBooking(id, dto, actor.id, actor.role);
  }

  // ─── List all bookings (paginated) ──────────────────────────────
  @Get()
  @ApiOperation({ summary: "Get paginated list of bookings with filters" })
  findAll(@Query() query: BookingsQueryDto) {
    return this.bookingsService.findAll(query);
  }

  // ─── My bookings ────────────────────────────────────────────────
  @Get("me")
  @ApiOperation({ summary: "Get the current user's bookings (paginated)" })
  findMyBookings(
    @Query() query: BookingsQueryDto,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.bookingsService.findMyBookings(actor.id, query);
  }

  // ─── Asset calendar view ────────────────────────────────────────
  @Get("assets/:assetId")
  @ApiOperation({ summary: "Get all bookings for a specific asset (calendar view)" })
  findByAsset(
    @Param("assetId") assetId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.bookingsService.findByAsset(assetId, from, to);
  }

  // ─── Get single booking detail ──────────────────────────────────
  @Get(":id")
  @ApiOperation({ summary: "Get booking detail by ID" })
  findOne(@Param("id") id: string) {
    return this.bookingsService.findOne(id);
  }

  // ─── Manually mark a booking as started ─────────────────────────
  @Post(":id/start")
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Manually start an upcoming booking (transition to Ongoing)" })
  startBooking(@Param("id") id: string) {
    return this.bookingsService.startBooking(id);
  }

  // ─── Manually mark a booking as completed ───────────────────────
  @Post(":id/complete")
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Manually complete a booking" })
  completeBooking(@Param("id") id: string) {
    return this.bookingsService.completeBooking(id);
  }

  // ─── Trigger status transition scan ─────────────────────────────
  @Post("jobs/status-transition")
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Trigger manual scan for booking status transitions (Upcoming→Ongoing→Completed)" })
  triggerStatusTransition() {
    return this.bookingsService.processBookingStatusTransitions();
  }

  // ─── Trigger booking reminders ──────────────────────────────────
  @Post("jobs/send-reminders")
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Trigger manual scan to send booking reminders" })
  triggerReminders(@Query("minutesBefore") minutesBefore?: string) {
    const minutes = minutesBefore ? parseInt(minutesBefore, 10) : 15;
    return this.bookingsService.sendBookingReminders(minutes);
  }
}
