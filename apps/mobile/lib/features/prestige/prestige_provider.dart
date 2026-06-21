import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';

// ── Prestige summary ─────────────────────────────────────────────────────────

final prestigeSummaryProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, starId) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>('/stars/$starId');
  return res.data!;
});

// ── Star history ─────────────────────────────────────────────────────────────

final starHistoryProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, starId) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<List<dynamic>>('/stars/$starId/history');
  return (res.data ?? []).cast<Map<String, dynamic>>();
});

// ── Achievements ──────────────────────────────────────────────────────────────

final achievementsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, starId) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<List<dynamic>>('/stars/$starId/achievements');
  return (res.data ?? []).cast<Map<String, dynamic>>();
});

// ── Leaderboard ───────────────────────────────────────────────────────────────

final leaderboardProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, (String, String)>(
        (ref, params) async {
  final dio = ref.watch(dioProvider);
  final (category, period) = params;
  final res = await dio.get<List<dynamic>>('/leaderboards',
      queryParameters: {'category': category, 'period': period, 'limit': 50});
  return (res.data ?? []).cast<Map<String, dynamic>>();
});

// ── Campaigns ─────────────────────────────────────────────────────────────────

final myCampaignsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, starId) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<List<dynamic>>('/campaigns/me',
      queryParameters: {'starId': starId});
  return (res.data ?? []).cast<Map<String, dynamic>>();
});

class CreateCampaignNotifier extends AsyncNotifier<Map<String, dynamic>?> {
  @override
  Future<Map<String, dynamic>?> build() async => null;

  Future<Map<String, dynamic>> create({
    required String starId,
    required String promotableType,
    required String promotableId,
    required String scope,
    int? durationHours,
  }) async {
    state = const AsyncLoading();
    final dio = ref.read(dioProvider);
    final res = await dio.post<Map<String, dynamic>>('/campaigns', data: {
      'starId': starId,
      'promotableType': promotableType,
      'promotableId': promotableId,
      'scope': scope,
      if (durationHours != null) 'durationHours': durationHours,
      'idempotencyKey': 'campaign:$starId:$promotableId:${DateTime.now().millisecondsSinceEpoch}',
    });
    final result = res.data!;
    state = AsyncData(result);
    return result;
  }
}

final createCampaignProvider =
    AsyncNotifierProvider<CreateCampaignNotifier, Map<String, dynamic>?>(() =>
        CreateCampaignNotifier());

// ── Upload status ─────────────────────────────────────────────────────────────

final uploadStatusProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, starId) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>('/stars/$starId/upload-status');
  return res.data!;
});
