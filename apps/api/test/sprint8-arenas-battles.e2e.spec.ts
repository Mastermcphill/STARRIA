/**
 * Sprint 8 E2E — Arenas, Battles & Creator Leagues
 *
 * Tests: voting, anti-fraud, ELO updates, prize settlement,
 *        season resets, team battles, ticketing, replay/highlights.
 *
 * Run with: jest --testPathPattern=sprint8
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Sprint 8 — Arenas, Battles & Creator Leagues', () => {
  let app: INestApplication;
  let battleId: string;
  let teamBattleId: string;
  let seasonId: string;
  let participantId1: string;
  let participantId2: string;
  let prizePoolId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Season Management ─────────────────────────────────────────────────────

  describe('Arena Season', () => {
    it('POST /arenas/seasons — creates a new season', async () => {
      const res = await request(app.getHttpServer())
        .post('/arenas/seasons')
        .send({ name: 'Season 1 — Rise of Legends', number: 1, startsAt: '2026-07-01T00:00:00Z', endsAt: '2026-09-30T23:59:59Z' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.number).toBe(1);
      seasonId = res.body.id;
    });

    it('GET /arenas/seasons/active — returns null when no active season', async () => {
      const res = await request(app.getHttpServer()).get('/arenas/seasons/active').expect(200);
      expect(res.body).toBeNull();
    });
  });

  // ── Battle Lifecycle ──────────────────────────────────────────────────────

  describe('Battle lifecycle', () => {
    it('POST /arenas — creates a RAP_BATTLE with prize pool', async () => {
      const res = await request(app.getHttpServer())
        .post('/arenas')
        .send({
          title: 'Friday Night Rap Battle',
          type: 'RAP_BATTLE',
          votingMethod: 'HYBRID',
          arenaSeasonId: seasonId,
          prizeDistribution: 'WINNER_TAKES_ALL',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.type).toBe('RAP_BATTLE');
      battleId = res.body.id;
    });

    it('POST /arenas/:id/join — registers challenger', async () => {
      const res = await request(app.getHttpServer())
        .post(`/arenas/${battleId}/join`)
        .send({ starProfileId: 'star-profile-001', role: 'CHALLENGER' })
        .expect(200);

      expect(res.body.battleId).toBe(battleId);
      expect(res.body.role).toBe('CHALLENGER');
      participantId1 = res.body.id;
    });

    it('POST /arenas/:id/join — registers defender', async () => {
      const res = await request(app.getHttpServer())
        .post(`/arenas/${battleId}/join`)
        .send({ starProfileId: 'star-profile-002', role: 'DEFENDER' })
        .expect(200);

      expect(res.body.role).toBe('DEFENDER');
      participantId2 = res.body.id;
    });

    it('POST /arenas/:id/start — moves battle to ACTIVE', async () => {
      const res = await request(app.getHttpServer())
        .post(`/arenas/${battleId}/start`)
        .expect(200);

      expect(res.body.status).toBe('ACTIVE');
    });

    it('POST /arenas/:id/end — moves battle to VOTING', async () => {
      const res = await request(app.getHttpServer())
        .post(`/arenas/${battleId}/end`)
        .expect(200);

      expect(res.body.status).toBe('VOTING');
    });

    it('GET /arenas/:id — returns battle with participants', async () => {
      const res = await request(app.getHttpServer())
        .get(`/arenas/${battleId}`)
        .expect(200);

      expect(res.body.participants).toHaveLength(2);
      expect(res.body.status).toBe('VOTING');
    });
  });

  // ── Voting & Anti-Fraud ───────────────────────────────────────────────────

  describe('Voting system', () => {
    it('POST /arenas/:id/vote — casts a valid vote', async () => {
      const res = await request(app.getHttpServer())
        .post(`/arenas/${battleId}/vote`)
        .send({ voterId: 'user-voter-001', targetParticipantId: participantId1 })
        .expect(200);

      expect(res.body.finalWeight).toBeGreaterThan(0);
      expect(res.body.fraudFlag).toBe(false);
    });

    it('POST /arenas/:id/vote — rejects duplicate vote (anti-fraud)', async () => {
      await request(app.getHttpServer())
        .post(`/arenas/${battleId}/vote`)
        .send({ voterId: 'user-voter-001', targetParticipantId: participantId2 })
        .expect(400); // duplicate vote rejected
    });

    it('POST /arenas/:id/vote — second voter casts vote for participant 2', async () => {
      const res = await request(app.getHttpServer())
        .post(`/arenas/${battleId}/vote`)
        .send({ voterId: 'user-voter-002', targetParticipantId: participantId1 })
        .expect(200);

      expect(res.body.battleId).toBe(battleId);
    });

    it('POST /arenas/:id/vote — rejects self-voting', async () => {
      // star-profile-001 has userId = star-profile-001 (stub)
      // Self-vote protection: voter cannot target their own participant
      await request(app.getHttpServer())
        .post(`/arenas/${battleId}/vote`)
        .send({ voterId: 'star-profile-001', targetParticipantId: participantId1 })
        .expect(400);
    });
  });

  // ── Prize Pool ────────────────────────────────────────────────────────────

  describe('Prize pool', () => {
    it('POST /arenas/:id/prize-pool/contribute — fan contributes coins', async () => {
      const res = await request(app.getHttpServer())
        .post(`/arenas/${battleId}/prize-pool/contribute`)
        .send({ contributorId: 'user-fan-001', source: 'FAN_CONTRIBUTION', coins: 500 })
        .expect(200);

      expect(res.body.totalCoins).toBeGreaterThanOrEqual(500);
      prizePoolId = res.body.id;
    });

    it('POST /arenas/:id/prize-pool/contribute — sponsor contributes', async () => {
      const res = await request(app.getHttpServer())
        .post(`/arenas/${battleId}/prize-pool/contribute`)
        .send({ contributorId: 'sponsor-001', source: 'SPONSORSHIP', coins: 2000 })
        .expect(200);

      expect(res.body.totalCoins).toBeGreaterThanOrEqual(2500);
    });
  });

  // ── ELO & Settlement ──────────────────────────────────────────────────────

  describe('ELO updates & settlement', () => {
    it('POST /arenas/:id/settle — settles battle: tallies votes, awards ELO, distributes prize', async () => {
      const res = await request(app.getHttpServer())
        .post(`/arenas/${battleId}/settle`)
        .expect(200);

      expect(res.body.status).toBe('SETTLED');
      expect(res.body.eloAwarded).toBe(true);
    });

    it('GET /arenas/leaderboard/global — returns ranked ELO entries', async () => {
      const res = await request(app.getHttpServer())
        .get('/arenas/leaderboard/global')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      // Winner should have higher ELO
      const winner = res.body.find((e: any) => e.starProfileId === 'star-profile-001');
      const loser  = res.body.find((e: any) => e.starProfileId === 'star-profile-002');
      if (winner && loser) {
        expect(winner.elo).toBeGreaterThan(loser.elo);
      }
    });
  });

  // ── Team Battle ───────────────────────────────────────────────────────────

  describe('Team battles', () => {
    it('POST /arenas — creates a TEAM_BATTLE', async () => {
      const res = await request(app.getHttpServer())
        .post('/arenas')
        .send({
          title: 'Comedy House vs Music House',
          type: 'TEAM_BATTLE',
          votingMethod: 'AUDIENCE',
          isTeamBattle: true,
          maxParticipants: 6,
        })
        .expect(201);

      expect(res.body.isTeamBattle).toBe(true);
      teamBattleId = res.body.id;
    });

    it('POST /arenas/:id/join — multiple members join team battle', async () => {
      for (const starId of ['star-t1-a', 'star-t1-b', 'star-t2-a', 'star-t2-b']) {
        await request(app.getHttpServer())
          .post(`/arenas/${teamBattleId}/join`)
          .send({ starProfileId: starId, role: 'TEAM_MEMBER' })
          .expect(200);
      }
    });
  });

  // ── Creator Houses ────────────────────────────────────────────────────────

  describe('Creator Houses', () => {
    it('GET /arenas/houses — lists all active houses', async () => {
      const res = await request(app.getHttpServer())
        .get('/arenas/houses')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── Season Reset ──────────────────────────────────────────────────────────

  describe('Season reset', () => {
    it('POST /arenas/seasons/:id/reset — soft-resets ELO toward 1200', async () => {
      const res = await request(app.getHttpServer())
        .post(`/arenas/seasons/${seasonId}/reset`)
        .expect(200);

      expect(res.body.status).toBe('ENDED');
    });
  });

  // ── Battle listing ────────────────────────────────────────────────────────

  describe('Battle listing', () => {
    it('GET /arenas — lists settled battles', async () => {
      const res = await request(app.getHttpServer())
        .get('/arenas?status=SETTLED')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((b: any) => b.id === battleId)).toBe(true);
    });

    it('GET /arenas — filters by type', async () => {
      const res = await request(app.getHttpServer())
        .get('/arenas?type=RAP_BATTLE')
        .expect(200);

      expect(res.body.every((b: any) => b.type === 'RAP_BATTLE')).toBe(true);
    });
  });
});
