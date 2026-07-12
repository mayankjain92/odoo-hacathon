import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class RescheduleBookingDto {
  @ApiPropertyOptional({ description: "New start time in ISO-8601 format", example: "2026-07-15T14:00:00.000Z" })
  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @ApiPropertyOptional({ description: "New end time in ISO-8601 format", example: "2026-07-15T16:00:00.000Z" })
  @IsDateString()
  @IsOptional()
  endsAt?: string;

  @ApiPropertyOptional({ description: "Updated purpose / reason", example: "Rescheduled: moved to afternoon slot" })
  @IsString()
  @IsOptional()
  purpose?: string;
}
