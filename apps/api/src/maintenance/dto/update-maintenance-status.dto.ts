import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { MaintenanceStatus } from "@assetflow/shared";

export class UpdateMaintenanceStatusDto {
  @ApiProperty({ enum: MaintenanceStatus, example: MaintenanceStatus.Approved })
  @IsEnum(MaintenanceStatus)
  @IsNotEmpty()
  status!: MaintenanceStatus;

  @ApiPropertyOptional({ description: "Assigned technician name", example: "John Doe" })
  @IsString()
  @IsOptional()
  technician?: string;
}
