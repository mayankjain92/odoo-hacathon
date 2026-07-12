import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";

export class AllocationsQueryDto {
  @ApiPropertyOptional({ description: "Page number (1-indexed)", default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: "Number of items per page", default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: "Filter allocations by Asset ID" })
  @IsString()
  @IsOptional()
  assetId?: string;

  @ApiPropertyOptional({ description: "Filter allocations by Employee (User) ID" })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional({ description: "Filter allocations by Department ID" })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ description: "Filter allocations by status", example: "overdue" })
  @IsString()
  @IsOptional()
  status?: "active" | "returned" | "overdue";
}
