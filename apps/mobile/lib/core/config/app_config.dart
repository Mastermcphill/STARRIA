/// Centralised runtime configuration for the STARRIA mobile app.
///
/// `apiBase` can be overridden at build time with:
///   flutter run --dart-define=STARRIA_API_BASE=https://api.starria.app
class AppConfig {
  /// Base URL for the STARRIA REST API.
  static const String apiBase = String.fromEnvironment(
    'STARRIA_API_BASE',
    defaultValue: 'http://localhost:3000',
  );

  /// LiveKit server websocket URL (Sprint 7).
  static const String livekitUrl = String.fromEnvironment(
    'STARRIA_LIVEKIT_URL',
    defaultValue: 'wss://livekit.starria.local',
  );
}
