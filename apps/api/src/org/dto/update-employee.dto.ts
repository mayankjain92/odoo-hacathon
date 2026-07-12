import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { EntityStatus } from "@assetflow/shared";

export class UpdateEmployeeDto {
  @ApiProperty({ example: "Amit Patel", required: false })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiProperty({ example: "seed-dept-engineering", required: false, nullable: true })
  @IsString()
  @IsOptional()
  departmentId?: string | null;

  @ApiProperty({ enum: EntityStatus, required: false })
  @IsEnum(EntityStatus)
  @IsOptional()
  status?: EntityStatus;
}
