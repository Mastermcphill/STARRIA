import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../livekit/livekit_room_controller.dart';
import '../livekit/widgets/video_grid_view.dart';
import '../livekit/widgets/room_controls_bar.dart';
import '../livekit/widgets/network_quality_badge.dart';

/// Production live room — replaces the legacy SmartStageView-based screen with
/// real LiveKit rendering: stage/grid layout, active-speaker detection,
/// reconnection handling and a full controls bar.
class LiveRoomScreenV2 extends StatefulWidget {
  final String roomId;
  final String userId;
  final bool isHost;

  const LiveRoomScreenV2({
    super.key,
    required this.roomId,
    required this.userId,
    this.isHost = false,
  });

  @override
  State<LiveRoomScreenV2> createState() => _LiveRoomScreenV2State();
}

class _LiveRoomScreenV2State extends State<LiveRoomScreenV2> {
  late final LiveKitRoomController _controller;
  StageLayout _layout = StageLayout.stage;
  bool _showControls = true;

  @override
  void initState() {
    super.initState();
    _controller = LiveKitRoomController(
      roomId: widget.roomId,
      identity: widget.userId,
      publishVideo: widget.isHost,
    );
    _controller.addListener(_onChange);
    _controller.connect();
  }

  void _onChange() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _controller.removeListener(_onChange);
    _controller.dispose();
    super.dispose();
  }

  Future<void> _leave() async {
    await _controller.dispose();
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onTap: () => setState(() => _showControls = !_showControls),
        child: Stack(
          children: [
            // ── Main stage ────────────────────────────────────────────────────
            Positioned.fill(child: _buildBody()),

            // ── Top status bar ────────────────────────────────────────────────
            if (_showControls)
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      _ConnPill(state: _controller.state),
                      const Spacer(),
                      if (_controller.room.localParticipant != null)
                        NetworkQualityBadge(
                          quality: _controller.room.localParticipant!.connectionQuality,
                        ),
                      const SizedBox(width: 8),
                      IconButton(
                        icon: Icon(
                          _layout == StageLayout.stage ? Icons.grid_view : Icons.view_agenda,
                          color: Colors.white,
                        ),
                        onPressed: () => setState(() => _layout =
                            _layout == StageLayout.stage ? StageLayout.grid : StageLayout.stage),
                      ),
                    ],
                  ),
                ),
              ),

            // ── Controls bar ──────────────────────────────────────────────────
            if (_showControls && _controller.state == RoomConnState.connected)
              Positioned(
                bottom: 0, left: 0, right: 0,
                child: RoomControlsBar(
                  room: _controller.room,
                  onLeave: _leave,
                  enableVideo: widget.isHost,
                  enableScreenShare: widget.isHost,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    switch (_controller.state) {
      case RoomConnState.connecting:
        return const _Centered(child: CircularProgressIndicator(color: Color(0xFFE040FB)), label: 'Connecting…');
      case RoomConnState.reconnecting:
        return const _Centered(child: CircularProgressIndicator(color: Colors.orange), label: 'Reconnecting…');
      case RoomConnState.error:
        return _Centered(
          child: const Icon(Icons.error_outline, color: Colors.red, size: 48),
          label: _controller.error ?? 'Connection error',
        );
      case RoomConnState.disconnected:
        return const _Centered(child: Icon(Icons.call_end, color: Colors.grey, size: 48), label: 'Disconnected');
      case RoomConnState.connected:
        return VideoGridView(room: _controller.room, layout: _layout);
      case RoomConnState.idle:
        return const SizedBox.shrink();
    }
  }
}

class _ConnPill extends StatelessWidget {
  final RoomConnState state;
  const _ConnPill({required this.state});

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (state) {
      RoomConnState.connected => (const Color(0xFF00E676), 'LIVE'),
      RoomConnState.reconnecting => (Colors.orange, 'RECONNECTING'),
      RoomConnState.connecting => (Colors.grey, 'CONNECTING'),
      RoomConnState.error => (Colors.red, 'ERROR'),
      RoomConnState.disconnected => (Colors.grey, 'ENDED'),
      RoomConnState.idle => (Colors.grey, ''),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(12)),
      child: Text(label,
          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
    );
  }
}

class _Centered extends StatelessWidget {
  final Widget child;
  final String label;
  const _Centered({required this.child, required this.label});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          child,
          const SizedBox(height: 12),
          Text(label, style: const TextStyle(color: Colors.grey)),
        ],
      ),
    );
  }
}
