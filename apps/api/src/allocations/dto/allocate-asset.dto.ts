import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsDateString, IsNotEmpty } from "class-validator";

export class AllocateAssetDto {
  @ApiProperty({ description: "Asset ID (cuid)", example: "clp1234560000xx88" })
  @IsString()
  @IsNotEmpty()
  assetId!: string;

  @ApiPropertyOptional({ description: "Employee ID (cuid) to allocate to", example: "clp1234560000xx99" })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional({ description: "Department ID (cuid) to allocate to", example: "clp1234560000xxaa" })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ description: "Expected return date/time in ISO-8601 format", example: "2026-08-12T12:00:00.000Z" })
  @IsDateString()
  @IsOptional()
  expectedReturnAt?: string;

  @ApiPropertyOptional({ description: "Notes for the allocation", example: "Assigned for remote work setup" })
  @IsString()
  @IsOptional()
  notes?: string;
}
