import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsInt, Min, IsDateString, IsIn } from "class-validator";
import { Type } from "class-transformer";

export class BookingsQueryDto {
  @ApiPropertyOptional({ description: "Page number (1-indexed)", default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: "Number of items per page", default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: "Filter by Asset ID" })
  @IsString()
  @IsOptional()
  assetId?: string;

  @ApiPropertyOptional({ description: "Filter by User (booker) ID" })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: "Filter by booking status",
    enum: ["Upcoming", "Ongoing", "Completed", "Cancelled"],
  })
  @IsString()
  @IsOptional()
  @IsIn(["Upcoming", "Ongoing", "Completed", "Cancelled"])
  status?: string;

  @ApiPropertyOptional({ description: "Filter bookings starting on or after this date (ISO-8601)", example: "2026-07-01T00:00:00.000Z" })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: "Filter bookings ending on or before this date (ISO-8601)", example: "2026-07-31T23:59:59.000Z" })
  @IsDateString()
  @IsOptional()
  to?: string;
}
