import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional } from "class-validator";

export class ReturnAssetDto {
  @ApiPropertyOptional({ description: "Return notes regarding condition or return details", example: "Returned in perfect condition" })
  @IsString()
  @IsOptional()
  returnNotes?: string;
}
