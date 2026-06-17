import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';

final searchRepositoryProvider = Provider<SearchRepository>((ref) {
  return SearchRepository(ref.watch(dioProvider));
});

class SearchHit {
  final String id;
  final String title;
  final String? creatorHandle;
  final String? genre;
  final String? country;
  final String? thumbnailUrl;
  final double score;
  const SearchHit({
    required this.id,
    required this.title,
    required this.score,
    this.creatorHandle,
    this.genre,
    this.country,
    this.thumbnailUrl,
  });

  factory SearchHit.fromJson(Map<String, dynamic> j) => SearchHit(
        id: j['id'] as String,
        title: j['title'] as String? ?? '',
        creatorHandle: j['creatorHandle'] as String?,
        genre: j['genre'] as String?,
        country: j['country'] as String?,
        thumbnailUrl: j['thumbnailUrl'] as String?,
        score: (j['score'] as num?)?.toDouble() ?? 0,
      );
}

class SearchRepository {
  final Dio _dio;
  SearchRepository(this._dio);

  Future<List<SearchHit>> search({
    String? q,
    String? creatorId,
    String? creatorHandle,
    String? country,
    String? language,
    String? genre,
  }) async {
    final res = await _dio.get('/search', queryParameters: {
      if (q != null && q.isNotEmpty) 'q': q,
      if (creatorId != null && creatorId.isNotEmpty) 'creatorId': creatorId,
      if (creatorHandle != null && creatorHandle.isNotEmpty) 'creatorHandle': creatorHandle,
      if (country != null && country.isNotEmpty) 'country': country,
      if (language != null && language.isNotEmpty) 'language': language,
      if (genre != null && genre.isNotEmpty) 'genre': genre,
    });
    final items = (res.data['items'] as List? ?? []);
    return items.map((e) => SearchHit.fromJson(e as Map<String, dynamic>)).toList();
  }
}
