import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsNotEmpty } from "class-validator";

export class CreateTransferDto {
  @ApiProperty({ description: "Asset ID to transfer (cuid)", example: "clp1234560000xx88" })
  @IsString()
  @IsNotEmpty()
  assetId!: string;

  @ApiPropertyOptional({ description: "Target Employee ID (cuid)", example: "clp1234560000xx99" })
  @IsString()
  @IsOptional()
  toEmployeeId?: string;

  @ApiPropertyOptional({ description: "Target Department ID (cuid)", example: "clp1234560000xxaa" })
  @IsString()
  @IsOptional()
  toDepartmentId?: string;

  @ApiPropertyOptional({ description: "Reason or notes for the transfer request", example: "Transferring laptop to new hire in engineering" })
  @IsString()
  @IsOptional()
  notes?: string;
}
