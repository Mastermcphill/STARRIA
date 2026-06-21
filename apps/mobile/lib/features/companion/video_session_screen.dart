import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// VideoSessionScreen — camera + mic controls, participant tiles.
/// LiveKit integration point: wire livekit_client tracks in Sprint 7.
/// SmartStageView equivalent: primary track fills top 70%, secondary tiles row below.
class VideoSessionScreen extends StatefulWidget {
  final String sessionId;
  final String userId;
  final String companionName;

  const VideoSessionScreen({
    super.key,
    required this.sessionId,
    required this.userId,
    required this.companionName,
  });

  @override
  State<VideoSessionScreen> createState() => _VideoSessionScreenState();
}

class _VideoSessionScreenState extends State<VideoSessionScreen> {
  bool _micMuted    = false;
  bool _cameraOff   = false;
  bool _showControls = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onTap: () => setState(() => _showControls = !_showControls),
        child: Stack(
          children: [
            // ── Primary video track (companion) ───────────────────────────────
            // TODO Sprint 7: replace with LiveKit VideoTrackRenderer
            Container(
              color: const Color(0xFF0D0D0D),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircleAvatar(
                      radius: 60,
                      backgroundColor: const Color(0xFF2A2A2A),
                      child: Text(widget.companionName[0].toUpperCase(),
                          style: const TextStyle(fontSize: 52, color: Color(0xFFE040FB))),
                    ),
                    const SizedBox(height: 12),
                    const Text('Connecting video…',
                        style: TextStyle(color: Colors.grey)),
                  ],
                ),
              ),
            ),

            // ── Self-view PiP ─────────────────────────────────────────────────
            Positioned(
              right: 16, top: 60,
              child: Container(
                width: 90, height: 130,
                decoration: BoxDecoration(
                  color: const Color(0xFF2A2A2A),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey[800]!),
                ),
                child: _cameraOff
                    ? const Icon(Icons.videocam_off, color: Colors.grey)
                    : const Center(child: Text('You', style: TextStyle(color: Colors.grey))),
              ),
            ),

            // ── Controls overlay ──────────────────────────────────────────────
            if (_showControls)
              Positioned(
                bottom: 0, left: 0, right: 0,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 40),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [Colors.black87, Colors.transparent],
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _VideoControl(
                        icon: _micMuted ? Icons.mic_off : Icons.mic,
                        active: !_micMuted,
                        onTap: () => setState(() => _micMuted = !_micMuted),
                      ),
                      _VideoControl(
                        icon: _cameraOff ? Icons.videocam_off : Icons.videocam,
                        active: !_cameraOff,
                        onTap: () => setState(() => _cameraOff = !_cameraOff),
                      ),
                      _VideoControl(
                        icon: Icons.call_end,
                        active: false,
                        danger: true,
                        onTap: () => context.pop(),
                      ),
                      _VideoControl(
                        icon: Icons.flip_camera_ios,
                        active: true,
                        onTap: () {},
                      ),
                    ],
                  ),
                ),
              ),

            // ── Panic leave button ────────────────────────────────────────────
            Positioned(
              top: 12, left: 12,
              child: SafeArea(
                child: TextButton.icon(
                  onPressed: () => context.go('/'),
                  icon: const Icon(Icons.exit_to_app, color: Colors.red, size: 16),
                  label: const Text('Leave', style: TextStyle(color: Colors.red, fontSize: 12)),
                  style: TextButton.styleFrom(
                    backgroundColor: Colors.black54,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VideoControl extends StatelessWidget {
  final IconData icon;
  final bool active;
  final bool danger;
  final VoidCallback onTap;

  const _VideoControl({
    required this.icon,
    required this.active,
    this.danger = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 56, height: 56,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: danger
              ? Colors.red
              : active
              ? Colors.white.withOpacity(0.15)
              : Colors.red.withOpacity(0.2),
        ),
        child: Icon(icon,
            color: danger ? Colors.white : active ? Colors.white : Colors.red,
            size: 24),
      ),
    );
  }
}
