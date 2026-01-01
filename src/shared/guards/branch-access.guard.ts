import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../enums/role.enum';

@Injectable()
export class BranchAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user } = request;
    const params = request.params;
    const body = request.body;
    const query = request.query;

    // Admins have access to everything
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Branch users can only access their own branch data
    if (user.role === UserRole.BRANCH) {
      const userBranchId = user.branchId;

      // Check branchId in params (e.g., /branch/:branchId, /alerts/branch/:branchId)
      if (params.branchId && params.branchId != userBranchId) {
        throw new ForbiddenException('Access denied. You can only access your own branch data.');
      }

      // Check branchId in body (e.g., creating resources with branchId)
      if (body.branchId && body.branchId != userBranchId) {
        throw new ForbiddenException('Access denied. You can only create resources for your own branch.');
      }

      // Check branchId in query params
      if (query.branchId && query.branchId != userBranchId) {
        throw new ForbiddenException('Access denied. You can only access your own branch data.');
      }

      return true;
    }

    return false;
  }
}