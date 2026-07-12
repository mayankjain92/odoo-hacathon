import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AssetStatus } from "@assetflow/shared";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateAssetStatusDto {
  @ApiProperty({ enum: AssetStatus })
  @IsEnum(AssetStatus)
  status!: (typeof AssetStatus)[keyof typeof AssetStatus];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
