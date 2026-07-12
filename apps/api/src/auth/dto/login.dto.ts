import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "admin@assetflow.local" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Admin@12345" })
  @IsString()
  @MinLength(1)
  password!: string;
}
