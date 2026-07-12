import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsDateString } from "class-validator";

export class ReportDateRangeDto {
  @ApiPropertyOptional({
    description: "Start of the reporting period (ISO-8601). Defaults to 30 days ago.",
    example: "2026-06-01T00:00:00.000Z",
  })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    description: "End of the reporting period (ISO-8601). Defaults to now.",
    example: "2026-07-12T23:59:59.000Z",
  })
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({ description: "Filter by department ID" })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ description: "Filter by asset category ID" })
  @IsString()
  @IsOptional()
  categoryId?: string;
}
