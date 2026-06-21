import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TokenRevocationService } from './token-revocation.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  /** Unique token id, set on issue; enables single-session revocation. */
  jti?: string;
  /** Issued-at (epoch seconds), set by the signer; used for revoke-all cutoff. */
  iat?: number;
  /** Expiry (epoch seconds), set by the signer. */
  exp?: number;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  jti?: string;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly revocation: TokenRevocationService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? '',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (await this.revocation.isRevoked(payload)) {
      throw new UnauthorizedException('Token has been revoked');
    }
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
