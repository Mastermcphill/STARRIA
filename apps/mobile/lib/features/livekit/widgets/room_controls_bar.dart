import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';

/// Bottom control bar for a LiveKit room: mute/unmute, camera on/off,
/// camera switch, screen share, and leave. Reads & writes the local
/// participant's track state directly.
class RoomControlsBar extends StatefulWidget {
  final Room room;
  final VoidCallback onLeave;
  final bool enableVideo;
  final bool enableScreenShare;

  const RoomControlsBar({
    super.key,
    required this.room,
    required this.onLeave,
    this.enableVideo = true,
    this.enableScreenShare = false,
  });

  @override
  State<RoomControlsBar> createState() => _RoomControlsBarState();
}

class _RoomControlsBarState extends State<RoomControlsBar> {
  LocalParticipant? get _me => widget.room.localParticipant;
  bool _busy = false;

  Future<void> _guard(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _toggleMic() => _guard(() async {
        final me = _me;
        if (me == null) return;
        await me.setMicrophoneEnabled(!me.isMicrophoneEnabled());
      });

  Future<void> _toggleCamera() => _guard(() async {
        final me = _me;
        if (me == null) return;
        await me.setCameraEnabled(!me.isCameraEnabled());
      });

  Future<void> _switchCamera() => _guard(() async {
        final me = _me;
        if (me == null) return;
        for (final pub in me.videoTrackPublications) {
          final track = pub.track;
          if (track is LocalVideoTrack) {
            final current = track.currentOptions;
            if (current is CameraCaptureOptions) {
              await track.setCameraPosition(
                current.cameraPosition == CameraPosition.front
                    ? CameraPosition.back
                    : CameraPosition.front,
              );
            }
          }
        }
      });

  Future<void> _toggleScreenShare() => _guard(() async {
        final me = _me;
        if (me == null) return;
        await me.setScreenShareEnabled(!me.isScreenShareEnabled());
      });

  @override
  Widget build(BuildContext context) {
    final me = _me;
    final micOn = me?.isMicrophoneEnabled() ?? false;
    final camOn = me?.isCameraEnabled() ?? false;
    final shareOn = me?.isScreenShareEnabled() ?? false;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
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
          _CtrlButton(
            icon: micOn ? Icons.mic : Icons.mic_off,
            active: micOn,
            label: 'Mic',
            onTap: _toggleMic,
          ),
          if (widget.enableVideo) ...[
            _CtrlButton(
              icon: camOn ? Icons.videocam : Icons.videocam_off,
              active: camOn,
              label: 'Camera',
              onTap: _toggleCamera,
            ),
            _CtrlButton(
              icon: Icons.flip_camera_ios,
              active: true,
              label: 'Flip',
              onTap: _switchCamera,
            ),
          ],
          if (widget.enableScreenShare)
            _CtrlButton(
              icon: shareOn ? Icons.stop_screen_share : Icons.screen_share,
              active: shareOn,
              label: 'Share',
              onTap: _toggleScreenShare,
            ),
          _CtrlButton(
            icon: Icons.call_end,
            active: false,
            danger: true,
            label: 'Leave',
            onTap: () async => widget.onLeave(),
          ),
        ],
      ),
    );
  }
}

class _CtrlButton extends StatelessWidget {
  final IconData icon;
  final bool active;
  final bool danger;
  final String label;
  final VoidCallback onTap;

  const _CtrlButton({
    required this.icon,
    required this.active,
    required this.label,
    required this.onTap,
    this.danger = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 52, height: 52,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: danger
                  ? Colors.red
                  : active
                      ? Colors.white.withOpacity(0.18)
                      : Colors.red.withOpacity(0.22),
            ),
            child: Icon(icon,
                color: danger ? Colors.white : active ? Colors.white : Colors.red,
                size: 24),
          ),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(color: Colors.grey[400], fontSize: 11)),
        ],
      ),
    );
  }
}
