import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../../../core/config/api_config.dart';
import '../../../core/session/session_store.dart';
import 'battle_models.dart';

// ── State notifiers ──────────────────────────────────────────────────────────

class BattlesNotifier extends StateNotifier<AsyncValue<List<Battle>>> {
  BattlesNotifier() : super(const AsyncValue.loading());

  Future<void> load({String? status, String? type}) async {
    state = const AsyncValue.loading();
    try {
      final params = <String, String>{};
      if (status != null) params['status'] = status;
      if (type != null) params['type'] = type;
      final uri = Uri.parse('${ApiConfig.baseUrl}/arenas').replace(queryParameters: params);
      final res = await http.get(uri);
      if (res.statusCode == 200) {
        final list = jsonDecode(res.body) as List<dynamic>;
        state = AsyncValue.data(list.map((j) => Battle.fromJson(j as Map<String, dynamic>)).toList());
      } else {
        state = AsyncValue.error('Failed to load battles', StackTrace.current);
      }
    } catch (e, s) {
      state = AsyncValue.error(e, s);
    }
  }

  Future<Battle?> createBattle({
    required String title,
    required String type,
    String votingMethod = 'HYBRID',
    bool isTeamBattle = false,
    String? arenaId,
    String? prizeDistribution,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/arenas'),
        headers: await SessionStore.jsonAuthHeaders(),
        body: jsonEncode({
          'title': title,
          'type': type,
          'votingMethod': votingMethod,
          'isTeamBattle': isTeamBattle,
          if (arenaId != null) 'arenaId': arenaId,
          if (prizeDistribution != null) 'prizeDistribution': prizeDistribution,
        }),
      );
      if (res.statusCode == 201) {
        final battle = Battle.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
        await load();
        return battle;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<bool> joinBattle(String battleId, String starProfileId, {String role = 'CHALLENGER'}) async {
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/arenas/$battleId/join'),
        headers: await SessionStore.jsonAuthHeaders(),
        body: jsonEncode({'starProfileId': starProfileId, 'role': role}),
      );
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<bool> startBattle(String battleId) async {
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/arenas/$battleId/start'),
        headers: await SessionStore.authHeaders(),
      );
      if (res.statusCode == 200) { await load(); return true; }
      return false;
    } catch (_) { return false; }
  }

  Future<bool> endBattle(String battleId) async {
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/arenas/$battleId/end'),
        headers: await SessionStore.authHeaders(),
      );
      if (res.statusCode == 200) { await load(); return true; }
      return false;
    } catch (_) { return false; }
  }

  /// voterId is derived from the auth token server-side, so it is not sent here.
  Future<bool> castVote(String battleId, String targetParticipantId) async {
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/arenas/$battleId/vote'),
        headers: await SessionStore.jsonAuthHeaders(),
        body: jsonEncode({'targetParticipantId': targetParticipantId}),
      );
      return res.statusCode == 200;
    } catch (_) { return false; }
  }
}

class LeaderboardNotifier extends StateNotifier<AsyncValue<List<CreatorEloEntry>>> {
  LeaderboardNotifier() : super(const AsyncValue.loading());

  Future<void> load({String? seasonId, String? division, int limit = 50}) async {
    state = const AsyncValue.loading();
    try {
      final params = <String, String>{'limit': limit.toString()};
      if (seasonId != null) params['seasonId'] = seasonId;
      if (division != null) params['division'] = division;
      final uri = Uri.parse('${ApiConfig.baseUrl}/arenas/leaderboard/global').replace(queryParameters: params);
      final res = await http.get(uri);
      if (res.statusCode == 200) {
        final list = jsonDecode(res.body) as List<dynamic>;
        state = AsyncValue.data(list.asMap().entries
            .map((e) => CreatorEloEntry.fromJson(e.value as Map<String, dynamic>, e.key + 1))
            .toList());
      } else {
        state = AsyncValue.error('Failed', StackTrace.current);
      }
    } catch (e, s) {
      state = AsyncValue.error(e, s);
    }
  }
}

class HousesNotifier extends StateNotifier<AsyncValue<List<CreatorHouse>>> {
  HousesNotifier() : super(const AsyncValue.loading());

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final res = await http.get(Uri.parse('${ApiConfig.baseUrl}/arenas/houses'));
      if (res.statusCode == 200) {
        final list = jsonDecode(res.body) as List<dynamic>;
        state = AsyncValue.data(list.map((j) => CreatorHouse.fromJson(j as Map<String, dynamic>)).toList());
      } else {
        state = AsyncValue.error('Failed', StackTrace.current);
      }
    } catch (e, s) {
      state = AsyncValue.error(e, s);
    }
  }
}

// ── Providers ────────────────────────────────────────────────────────────────

final battlesProvider = StateNotifierProvider<BattlesNotifier, AsyncValue<List<Battle>>>(
  (_) => BattlesNotifier(),
);

final leaderboardProvider = StateNotifierProvider<LeaderboardNotifier, AsyncValue<List<CreatorEloEntry>>>(
  (_) => LeaderboardNotifier(),
);

final housesProvider = StateNotifierProvider<HousesNotifier, AsyncValue<List<CreatorHouse>>>(
  (_) => HousesNotifier(),
);
