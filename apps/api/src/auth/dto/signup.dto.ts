import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class SignupDto {
  @ApiProperty({ example: "Priya Sharma" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "priya@company.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "SecurePass1", minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
