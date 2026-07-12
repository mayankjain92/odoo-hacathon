import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsString, IsOptional, IsNotEmpty } from "class-validator";
import { TransferStatus } from "@assetflow/shared";

export class ResolveTransferDto {
  @ApiProperty({ enum: TransferStatus, example: TransferStatus.Approved })
  @IsEnum(TransferStatus)
  @IsNotEmpty()
  status!: TransferStatus;

  @ApiPropertyOptional({ description: "Resolution notes", example: "Approved as per department transfer request" })
  @IsString()
  @IsOptional()
  notes?: string;
}
