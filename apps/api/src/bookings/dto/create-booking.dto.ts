import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsDateString, IsOptional } from "class-validator";

export class CreateBookingDto {
  @ApiProperty({ description: "Asset ID to book (must be a shared/bookable resource)", example: "clp1234560000xx88" })
  @IsString()
  @IsNotEmpty()
  assetId!: string;

  @ApiProperty({ description: "Booking start time in ISO-8601 format", example: "2026-07-15T09:00:00.000Z" })
  @IsDateString()
  @IsNotEmpty()
  startsAt!: string;

  @ApiProperty({ description: "Booking end time in ISO-8601 format", example: "2026-07-15T11:00:00.000Z" })
  @IsDateString()
  @IsNotEmpty()
  endsAt!: string;

  @ApiPropertyOptional({ description: "Purpose / reason for the booking", example: "Team standup meeting" })
  @IsString()
  @IsOptional()
  purpose?: string;
}
