import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Central accessor for the authenticated session. Tokens + user id are written
/// at login (POST /auth/login) and read here so feature screens never hardcode
/// identities. Replaces the `current-user-id` placeholders (P2-05).
class SessionStore {
  static const _storage = FlutterSecureStorage();
  static const _kAccessToken = 'access_token';
  static const _kRefreshToken = 'refresh_token';
  static const _kUserId = 'user_id';

  static Future<void> save({
    required String accessToken,
    required String refreshToken,
    required String userId,
  }) async {
    await _storage.write(key: _kAccessToken, value: accessToken);
    await _storage.write(key: _kRefreshToken, value: refreshToken);
    await _storage.write(key: _kUserId, value: userId);
  }

  static Future<void> clear() async {
    await _storage.delete(key: _kAccessToken);
    await _storage.delete(key: _kRefreshToken);
    await _storage.delete(key: _kUserId);
  }

  static Future<String?> accessToken() => _storage.read(key: _kAccessToken);
  static Future<String?> userId() => _storage.read(key: _kUserId);

  /// Authorization-only headers (for GET requests).
  static Future<Map<String, String>> authHeaders() async {
    final token = await accessToken();
    return {if (token != null) 'Authorization': 'Bearer $token'};
  }

  /// Authorization + JSON content-type (for POST/PUT bodies).
  static Future<Map<String, String>> jsonAuthHeaders() async {
    final headers = await authHeaders();
    headers['Content-Type'] = 'application/json';
    return headers;
  }
}
