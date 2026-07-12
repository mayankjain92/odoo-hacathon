import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateCategoryDto {
  @ApiProperty({ example: "Electronics" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "Laptops, phones, peripherals", required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: { warrantyMonths: 12 }, required: false })
  @IsObject()
  @IsOptional()
  optionalFields?: Record<string, any>;
}
