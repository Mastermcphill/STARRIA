import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<FastifyRequest & { user?: { id?: string; sub?: string } }>();
    const reply = http.getResponse<FastifyReply>();

    const requestId =
      (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    // Attach to reply so downstream code can forward it.
    reply.header('x-request-id', requestId);

    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const userId = req.user?.id ?? req.user?.sub ?? '-';
        this.logger.log({
          requestId,
          userId,
          method,
          url,
          statusCode: reply.statusCode,
          latencyMs: Date.now() - start,
        });
      }),
      catchError((err: Error) => {
        const userId = req.user?.id ?? req.user?.sub ?? '-';
        this.logger.error({
          requestId,
          userId,
          method,
          url,
          statusCode: reply.statusCode,
          latencyMs: Date.now() - start,
          error: err.message,
          stack: err.stack,
        });
        return throwError(() => err);
      }),
    );
  }
}
