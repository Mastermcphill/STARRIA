import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from './jwt.strategy';
import { TokenRevocationService } from './token-revocation.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

const BCRYPT_ROUNDS = 12;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; username: string; role: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly revocation: TokenRevocationService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Email or username already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        displayName: dto.displayName,
        passwordHash,
      },
      select: { id: true, email: true, username: true, role: true },
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        passwordHash: true,
        isSuspended: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isSuspended) {
      throw new ForbiddenException('Account is suspended');
    }

    const { isSuspended: _suspended, ...claims } = user;
    return this.issueTokens(claims);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload & { typ?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException('Not a refresh token');
    }

    // A revoked-all watermark (logout-everywhere / suspension) invalidates
    // outstanding refresh tokens too, not just access tokens.
    if (await this.revocation.isRevoked(payload)) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, username: true, role: true, isSuspended: true },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    if (user.isSuspended) {
      throw new ForbiddenException('Account is suspended');
    }

    const { isSuspended: _suspended, ...claims } = user;
    return this.issueTokens(claims);
  }

  /** Logout: revoke the single access-token session identified by its jti. */
  async logout(jti: string | undefined, exp?: number): Promise<{ revoked: boolean }> {
    if (!jti) return { revoked: false };
    await this.revocation.revokeSession(jti, exp);
    return { revoked: true };
  }

  /** Revoke every active session/token the user holds (logout everywhere). */
  async revokeAllSessions(userId: string): Promise<{ revoked: boolean }> {
    await this.revocation.revokeAllForUser(userId);
    return { revoked: true };
  }

  private issueTokens(user: {
    id: string;
    email: string;
    username: string;
    role: string;
  }): AuthTokens {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = this.jwt.sign(payload, {
      // Unique per-issue id enables single-session (logout) revocation.
      jwtid: randomUUID(),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '7d',
    });
    const refreshToken = this.jwt.sign(
      { ...payload, typ: 'refresh' },
      {
        secret: this.refreshSecret(),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d',
      },
    );
    return { accessToken, refreshToken, user };
  }

  private refreshSecret(): string {
    return (
      this.config.get<string>('JWT_REFRESH_SECRET') ??
      `${this.config.get<string>('JWT_SECRET')}:refresh`
    );
  }
}
