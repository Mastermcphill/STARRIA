import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';

final uploadRepositoryProvider = Provider<UploadRepository>((ref) {
  return UploadRepository(ref.watch(dioProvider));
});

class UploadRepository {
  final Dio _dio;
  UploadRepository(this._dio);

  /// In the MVP the binary is assumed already uploaded to object storage and
  /// referenced by [storageKey]; this registers + processes + publishes it.
  Future<Map<String, dynamic>> upload({
    required String title,
    String? description,
    required String genre,
    required String storageKey,
    String? country,
    String? language,
    List<String>? tags,
  }) async {
    final res = await _dio.post('/videos/upload', data: {
      'title': title,
      if (description != null) 'description': description,
      'genre': genre,
      'storageKey': storageKey,
      if (country != null) 'country': country,
      if (language != null) 'language': language,
      if (tags != null) 'tags': tags,
    });
    return res.data as Map<String, dynamic>;
  }
}
