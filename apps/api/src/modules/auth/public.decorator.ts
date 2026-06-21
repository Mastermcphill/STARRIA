import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route (or whole controller) as public — bypasses the global
 * JwtAuthGuard. Apply to login/register, health probes, and intentionally
 * public read endpoints (discovery, search).
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
