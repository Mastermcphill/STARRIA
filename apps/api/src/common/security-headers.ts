import type { FastifyInstance } from 'fastify';

/**
 * Apply HTTP security headers to every response. This is a dependency-free
 * equivalent of the headers `helmet` sets — added directly via a Fastify onSend
 * hook so we do not take on a new package (and the lockfile churn that implies).
 *
 * Headers:
 *  - Content-Security-Policy: locked down by default; relaxed for the Swagger
 *    docs route which needs inline styles/scripts. Override via CSP env vars.
 *  - Strict-Transport-Security: force HTTPS for a year (prod only).
 *  - X-Content-Type-Options / X-Frame-Options / Referrer-Policy /
 *    Cross-Origin-Opener-Policy / Cross-Origin-Resource-Policy / X-DNS-Prefetch.
 */
export function applySecurityHeaders(app: FastifyInstance): void {
  const isProd = process.env.NODE_ENV === 'production';
  const apiCsp =
    process.env.CONTENT_SECURITY_POLICY ??
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";
  // Swagger UI requires inline styles/scripts + same-origin assets.
  const docsCsp =
    process.env.DOCS_CONTENT_SECURITY_POLICY ??
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'";

  app.addHook('onSend', (request, reply, payload, done) => {
    const url = request.url.split('?')[0];
    const isDocs = url === '/docs' || url.startsWith('/docs/');

    reply.header('Content-Security-Policy', isDocs ? docsCsp : apiCsp);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-DNS-Prefetch-Control', 'off');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Cross-Origin-Resource-Policy', 'same-origin');
    reply.header('X-Permitted-Cross-Domain-Policies', 'none');
    reply.header('Origin-Agent-Cluster', '?1');
    // Remove framework fingerprinting.
    reply.removeHeader('X-Powered-By');

    if (isProd) {
      reply.header(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
    }
    done(null, payload);
  });
}
