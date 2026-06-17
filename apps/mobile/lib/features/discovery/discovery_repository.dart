import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import 'discovery_models.dart';

final discoveryRepositoryProvider = Provider<DiscoveryRepository>((ref) {
  return DiscoveryRepository(ref.watch(dioProvider));
});

class DiscoveryRepository {
  final Dio _dio;
  DiscoveryRepository(this._dio);

  Future<List<GenreInfo>> genres() async {
    final res = await _dio.get('/discovery/genres');
    return (res.data as List).map((e) => GenreInfo.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<DiscoveryItem>> feed({
    required String genre,
    String? country,
    String? language,
    String? cursor,
    int limit = 10,
  }) async {
    final res = await _dio.get('/discovery/feed', queryParameters: {
      'genre': genre,
      if (country != null) 'country': country,
      if (language != null) 'language': language,
      if (cursor != null) 'cursor': cursor,
      'limit': limit,
    });
    final items = (res.data['items'] as List? ?? []);
    return items.map((e) => DiscoveryItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<DiscoveryItem>> local({String? country, String? genre, int limit = 20}) async {
    final res = await _dio.get('/discovery/local', queryParameters: {
      if (country != null) 'country': country,
      if (genre != null) 'genre': genre,
      'limit': limit,
    });
    return (res.data as List).map((e) => DiscoveryItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<TrendingItem>> trending({String scope = 'GLOBAL', int limit = 20}) async {
    final path = scope == 'GLOBAL' ? '/discovery/trending' : '/discovery/trending/$scope';
    final res = await _dio.get(path, queryParameters: {'limit': limit});
    return (res.data as List).map((e) => TrendingItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  // ── Watch analytics ────────────────────────────────────────────────────────

  Future<String> startWatch(String videoId, {String? country}) async {
    final res = await _dio.post('/watch/start', data: {'videoId': videoId, if (country != null) 'country': country});
    return res.data['watchId'] as String;
  }

  Future<void> completeWatch(String watchId, int watchSeconds, int durationSeconds) async {
    await _dio.post('/watch/complete', data: {
      'watchId': watchId,
      'watchSeconds': watchSeconds,
      'durationSeconds': durationSeconds,
    });
  }

  Future<DiscoveryItem> getVideo(String videoId) async {
    final res = await _dio.get('/videos/$videoId');
    return DiscoveryItem.fromJson(res.data as Map<String, dynamic>);
  }

  // ── Content tap ──────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> tap(String videoId, {String? country}) async {
    final res = await _dio.post('/content-taps', data: {'videoId': videoId, if (country != null) 'country': country});
    return res.data as Map<String, dynamic>;
  }
}
