import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:livekit_client/livekit_client.dart';
import '../../core/config/app_config.dart';

/// Connection state surfaced to the UI.
enum RoomConnState { idle, connecting, connected, reconnecting, disconnected, error }

/// Owns a LiveKit [Room] instance for a screen: fetches an access token from
/// the API, connects with production-grade options (adaptive stream + dynacast),
/// manages reconnection, audio routing (incl. Bluetooth) and app-lifecycle
/// background handling.
///
/// Usage:
///   final controller = LiveKitRoomController(roomId: ..., identity: ...);
///   await controller.connect();
///   ... controller.room ...
///   await controller.dispose();
class LiveKitRoomController extends ChangeNotifier with WidgetsBindingObserver {
  final String roomId;
  final String identity;
  final bool publishVideo;

  LiveKitRoomController({
    required this.roomId,
    required this.identity,
    this.publishVideo = true,
  });

  final Room room = Room(
    roomOptions: const RoomOptions(
      adaptiveStream: true, // scale down unseen tracks
      dynacast: true,       // pause layers nobody is subscribed to
    ),
  );

  RoomConnState state = RoomConnState.idle;
  String? error;
  EventsListener<RoomEvent>? _listener;
  bool _cameraWasOnBeforeBackground = false;

  /// Fetch a token from the session-engine join endpoint then connect.
  Future<void> connect() async {
    _setState(RoomConnState.connecting);
    WidgetsBinding.instance.addObserver(this);
    try {
      final token = await _fetchToken();

      _listener = room.createListener();
      _listener!
        ..on<RoomDisconnectedEvent>((_) => _setState(RoomConnState.disconnected))
        ..on<RoomReconnectingEvent>((_) => _setState(RoomConnState.reconnecting))
        ..on<RoomReconnectedEvent>((_) => _setState(RoomConnState.connected));

      await room.connect(AppConfig.livekitUrl, token);

      // Publish local media according to the room kind.
      await room.localParticipant?.setMicrophoneEnabled(true);
      if (publishVideo) {
        await room.localParticipant?.setCameraEnabled(true);
      }

      _setState(RoomConnState.connected);
    } catch (e) {
      error = e.toString();
      _setState(RoomConnState.error);
    }
  }

  Future<String> _fetchToken() async {
    final res = await http.post(
      Uri.parse('${AppConfig.apiBase}/rooms/$roomId/join'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'userId': identity, 'role': publishVideo ? 'PERFORMER' : 'VIEWER'}),
    );
    if (res.statusCode != 200 && res.statusCode != 201) {
      throw Exception('Failed to join room (${res.statusCode})');
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final token = data['token'] as String?;
    if (token == null) throw Exception('No token returned by server');
    return token;
  }

  /// Route audio to the speakerphone (vs earpiece / Bluetooth headset).
  ///
  /// LiveKit auto-selects a connected Bluetooth device; this only toggles the
  /// speaker vs earpiece preference. Best-effort — guarded so platforms that
  /// don't expose audio routing simply ignore it.
  Future<void> setSpeakerphone(bool on) async {
    try {
      await Hardware.instance.setSpeakerphoneOn(on);
    } catch (_) {
      // not all platforms expose audio routing
    }
  }

  // ── App lifecycle: pause camera in background, resume on return ───────────────
  @override
  void didChangeAppLifecycleState(AppLifecycleState appState) {
    final me = room.localParticipant;
    if (me == null) return;
    if (appState == AppLifecycleState.paused || appState == AppLifecycleState.inactive) {
      _cameraWasOnBeforeBackground = me.isCameraEnabled();
      if (_cameraWasOnBeforeBackground) {
        me.setCameraEnabled(false); // free camera while backgrounded
      }
    } else if (appState == AppLifecycleState.resumed) {
      if (_cameraWasOnBeforeBackground) {
        me.setCameraEnabled(true);
      }
    }
  }

  void _setState(RoomConnState s) {
    state = s;
    notifyListeners();
  }

  @override
  Future<void> dispose() async {
    WidgetsBinding.instance.removeObserver(this);
    await _listener?.dispose();
    await room.disconnect();
    await room.dispose();
    super.dispose();
  }
}
