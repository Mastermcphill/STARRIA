// Thin convenience wrapper — delegates to AppConfig.
// All Sprint 8+ code uses ApiConfig.baseUrl consistently.
import 'app_config.dart';

class ApiConfig {
  static String get baseUrl => AppConfig.apiBase;
}
