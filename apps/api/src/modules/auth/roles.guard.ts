import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

/**
 * Privilege ranking. Higher rank may do everything a lower rank can.
 * SUPPORTER and STAR are both base ("USER") accounts for authorization
 * purposes — they differ as product personas, not as privilege levels.
 */
export const ROLE_RANK: Record<UserRole, number> = {
  SUPPORTER: 0,
  STAR: 0,
  MODERATOR: 50,
  ADMIN: 100,
};

/**
 * Global role guard. Runs after JwtAuthGuard (which populates `req.user`).
 * Routes without an @Roles() decorator are allowed for any authenticated user.
 * Routes with @Roles(R...) require the caller's role rank to be >= the lowest
 * required role's rank, which makes the hierarchy automatic: an ADMIN passes
 * any @Roles(MODERATOR) route without it being listed explicitly.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No role requirement → any authenticated user is fine.
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: { role?: string } }>();
    const role = req.user?.role;

    // Unknown/missing role is treated as the lowest privilege (base user),
    // never granted elevated access by default.
    const callerRank =
      role && role in ROLE_RANK ? ROLE_RANK[role as UserRole] : 0;
    const requiredRank = Math.min(...required.map((r) => ROLE_RANK[r]));

    if (callerRank < requiredRank) {
      throw new ForbiddenException('Insufficient role for this action');
    }
    return true;
  }
}
