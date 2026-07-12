import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { AuditItemResult } from "@assetflow/shared";

export class RecordAuditItemDto {
  @ApiProperty({ description: "Asset Tag (e.g. AF-0001)" })
  @IsString()
  @IsNotEmpty()
  assetTag!: string;

  @ApiProperty({ enum: AuditItemResult, example: AuditItemResult.Verified })
  @IsEnum(AuditItemResult)
  @IsNotEmpty()
  result!: AuditItemResult;

  @ApiPropertyOptional({ description: "Optional notes from the auditor" })
  @IsString()
  @IsOptional()
  notes?: string;
}
