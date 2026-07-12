import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateBookingDto {
  @ApiProperty({ description: "ID of the asset to book" })
  @IsString()
  assetId!: string;

  @ApiProperty({ description: "Start time of the booking (ISO format)" })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ description: "End time of the booking (ISO format)" })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ description: "Optional purpose or notes" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;
}
