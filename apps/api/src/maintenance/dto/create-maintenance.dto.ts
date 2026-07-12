import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsEnum, IsOptional } from "class-validator";
import { MaintenancePriority } from "@assetflow/shared";

export class CreateMaintenanceDto {
  @ApiProperty({ description: "Asset ID (cuid)", example: "clp1234560000xx88" })
  @IsString()
  @IsNotEmpty()
  assetId!: string;

  @ApiProperty({ description: "Description of the maintenance issue", example: "Screen is flickering" })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ enum: MaintenancePriority, default: MaintenancePriority.Medium })
  @IsEnum(MaintenancePriority)
  @IsOptional()
  priority?: MaintenancePriority = MaintenancePriority.Medium;

  @ApiPropertyOptional({ description: "Photo URL of the issue", example: "http://example.com/photo.jpg" })
  @IsString()
  @IsOptional()
  photoUrl?: string;
}
