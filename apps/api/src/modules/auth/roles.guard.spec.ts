import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard, ROLE_RANK } from './roles.guard';

function contextFor(role: string | undefined): ExecutionContext {
  const req = { user: role ? { role } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function guardWith(required: UserRole[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(required),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows any authenticated user when no roles are required', () => {
    expect(guardWith(undefined).canActivate(contextFor('SUPPORTER'))).toBe(true);
    expect(guardWith([]).canActivate(contextFor(undefined))).toBe(true);
  });

  it('blocks a base USER (SUPPORTER/STAR) from admin routes', () => {
    const guard = guardWith([UserRole.ADMIN]);
    expect(() => guard.canActivate(contextFor('SUPPORTER'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor('STAR'))).toThrow(ForbiddenException);
  });

  it('blocks a MODERATOR from admin-only routes', () => {
    const guard = guardWith([UserRole.ADMIN]);
    expect(() => guard.canActivate(contextFor('MODERATOR'))).toThrow(ForbiddenException);
  });

  it('lets a MODERATOR perform moderation actions', () => {
    const guard = guardWith([UserRole.MODERATOR]);
    expect(guard.canActivate(contextFor('MODERATOR'))).toBe(true);
  });

  it('lets an ADMIN do everything (hierarchy)', () => {
    expect(guardWith([UserRole.MODERATOR]).canActivate(contextFor('ADMIN'))).toBe(true);
    expect(guardWith([UserRole.ADMIN]).canActivate(contextFor('ADMIN'))).toBe(true);
  });

  it('treats an unknown/missing role as the lowest privilege', () => {
    const guard = guardWith([UserRole.MODERATOR]);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor('BOGUS'))).toThrow(ForbiddenException);
  });

  it('ranks ADMIN above MODERATOR above base users', () => {
    expect(ROLE_RANK.ADMIN).toBeGreaterThan(ROLE_RANK.MODERATOR);
    expect(ROLE_RANK.MODERATOR).toBeGreaterThan(ROLE_RANK.STAR);
    expect(ROLE_RANK.STAR).toBe(ROLE_RANK.SUPPORTER);
  });
});
