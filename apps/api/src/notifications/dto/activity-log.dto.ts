import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { ActivityAction, EntityType } from "@assetflow/shared";

export class ActivityLogQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;

  @ApiProperty({ enum: EntityType, required: false })
  @IsEnum(EntityType)
  @IsOptional()
  entityType?: EntityType;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  entityId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  actorId?: string;

  @ApiProperty({ enum: ActivityAction, required: false })
  @IsEnum(ActivityAction)
  @IsOptional()
  action?: ActivityAction;
}
