import { IsString, IsEnum, IsOptional, IsNumber, IsNotEmpty } from 'class-validator';
import { UserRole } from '../../shared/enums/role.enum';

export class UserDto {
  @IsNotEmpty({ message: 'Username is required' })
  username: string;

  @IsString({ message: 'Password must be a string' })
  @IsOptional()
  password?: string;

  @IsEnum(UserRole, { message: 'Role must be either Admin or Branch' })
  @IsNotEmpty({ message: 'Role is required' })
  role: UserRole;

  @IsNotEmpty({ message: 'Branch name is required' })
  branchName: string;
}