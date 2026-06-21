import 'dart:io';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';

final mediaRepositoryProvider = Provider<MediaRepository>((ref) {
  return MediaRepository(ref.watch(dioProvider));
});

/// Result of a completed upload — the caller uses [key] as storageKey and
/// [url] for display / playback.
class UploadedMedia {
  final String id;
  final String key;
  final String url;
  final String contentType;

  const UploadedMedia({
    required this.id,
    required this.key,
    required this.url,
    required this.contentType,
  });
}

class MediaRepository {
  final Dio _dio;

  MediaRepository(this._dio);

  /// Open the system file picker and upload the selected file to R2 via a
  /// presigned PUT URL.  Returns the completed [UploadedMedia] record.
  ///
  /// [purpose] must be one of: avatars | images | videos
  Future<UploadedMedia> pickAndUpload({
    required String purpose,
    List<String>? allowedExtensions,
    FileType fileType = FileType.any,
    void Function(double progress)? onProgress,
  }) async {
    final result = await FilePicker.platform.pickFiles(
      type: fileType,
      allowedExtensions: allowedExtensions,
      withData: false,
      withReadStream: false,
    );
    if (result == null || result.files.isEmpty) {
      throw Exception('No file selected');
    }

    final file = result.files.single;
    if (file.path == null) throw Exception('Could not access file path');

    final ioFile = File(file.path!);
    final fileSize = await ioFile.length();
    final contentType = _inferContentType(file.name);

    // 1. Request presigned PUT URL from our API.
    final urlRes = await _dio.post<Map<String, dynamic>>('/media/upload-url', data: {
      'purpose': purpose,
      'fileName': file.name,
      'contentType': contentType,
      'size': fileSize,
    });
    final body = urlRes.data!;
    final uploadId = body['uploadId'] as String;
    final uploadUrl = body['uploadUrl'] as String;
    final key = body['key'] as String;

    // 2. PUT the file directly to R2 (bypasses our API — no auth header).
    final rawDio = Dio();
    await rawDio.put<void>(
      uploadUrl,
      data: ioFile.openRead(),
      options: Options(
        headers: {
          HttpHeaders.contentTypeHeader: contentType,
          HttpHeaders.contentLengthHeader: fileSize,
        },
        sendTimeout: const Duration(minutes: 10),
        receiveTimeout: const Duration(minutes: 2),
      ),
      onSendProgress: (sent, total) {
        if (onProgress != null && total > 0) {
          onProgress(sent / total);
        }
      },
    );

    // 3. Notify the API that the upload is complete.
    final completeRes = await _dio.post<Map<String, dynamic>>('/media/complete', data: {
      'uploadId': uploadId,
    });
    final completed = completeRes.data!;

    return UploadedMedia(
      id: completed['id'] as String,
      key: key,
      url: completed['url'] as String,
      contentType: contentType,
    );
  }

  String _inferContentType(String fileName) {
    final lower = fileName.toLowerCase();
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.mov')) return 'video/quicktime';
    if (lower.endsWith('.avi')) return 'video/x-msvideo';
    if (lower.endsWith('.mkv')) return 'video/x-matroska';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.heic')) return 'image/heic';
    return 'application/octet-stream';
  }
}
