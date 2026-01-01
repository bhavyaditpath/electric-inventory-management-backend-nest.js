import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../enums/role.enum';

@Injectable()
export class AdminOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Access denied. Admin role required.');
    }

    return true;
  }
}