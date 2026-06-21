import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route (or controller) to one or more roles. Enforced by
 * {@link RolesGuard} using a privilege hierarchy (ADMIN > MODERATOR > base
 * user), so decorating a route with the *minimum* role that may use it is
 * enough — higher roles are always permitted.
 *
 *   @Roles(UserRole.MODERATOR)  // moderators AND admins
 *   @Roles(UserRole.ADMIN)      // admins only
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
