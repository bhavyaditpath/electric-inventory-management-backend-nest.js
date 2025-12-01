import { IsEnum, IsNotEmpty, MinLength } from "class-validator";
import { UserRole } from "../../shared/enums/role.enum";

export class RegisterDto {
  @IsNotEmpty()
  username: string;

  @IsNotEmpty()
  @MinLength(4)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;
}
