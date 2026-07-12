import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";
import { AuditCycleStatus } from "@assetflow/shared";

export class UpdateAuditStatusDto {
  @ApiProperty({ enum: AuditCycleStatus, example: AuditCycleStatus.InProgress })
  @IsEnum(AuditCycleStatus)
  @IsNotEmpty()
  status!: AuditCycleStatus;
}
