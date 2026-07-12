import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { Role } from "@assetflow/shared";

export class PromoteEmployeeDto {
  @ApiProperty({ enum: Role, example: Role.AssetManager })
  @IsEnum(Role)
  role!: Role;
}
