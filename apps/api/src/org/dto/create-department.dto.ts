import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { EntityStatus } from "@assetflow/shared";

export class CreateDepartmentDto {
  @ApiProperty({ example: "Engineering" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "seed-dept-engineering", required: false, nullable: true })
  @IsString()
  @IsOptional()
  parentId?: string | null;

  @ApiProperty({ example: "user-id-here", required: false, nullable: true })
  @IsString()
  @IsOptional()
  headId?: string | null;

  @ApiProperty({ enum: EntityStatus, default: EntityStatus.Active, required: false })
  @IsEnum(EntityStatus)
  @IsOptional()
  status?: EntityStatus;
}
