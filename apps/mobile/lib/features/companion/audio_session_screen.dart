import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Audio-only session room — waveform visualizer, mute, end controls.
/// LiveKit integration point: wire to LiveKit Flutter SDK in Sprint 7.
class AudioSessionScreen extends StatefulWidget {
  final String sessionId;
  final String userId;
  final String companionName;

  const AudioSessionScreen({
    super.key,
    required this.sessionId,
    required this.userId,
    required this.companionName,
  });

  @override
  State<AudioSessionScreen> createState() => _AudioSessionScreenState();
}

class _AudioSessionScreenState extends State<AudioSessionScreen>
    with SingleTickerProviderStateMixin {
  bool _muted  = false;
  late final AnimationController _waveController;

  @override
  void initState() {
    super.initState();
    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _waveController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ────────────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  const Icon(Icons.headphones, color: Color(0xFFE040FB)),
                  const SizedBox(width: 8),
                  Text('Audio Session',
                      style: Theme.of(context).textTheme.titleMedium
                          ?.copyWith(color: Colors.white)),
                ],
              ),
            ),

            const Spacer(),

            // ── Avatar + waveform ─────────────────────────────────────────────
            CircleAvatar(
              radius: 56,
              backgroundColor: const Color(0xFF2A2A2A),
              child: Text(widget.companionName[0].toUpperCase(),
                  style: const TextStyle(fontSize: 48, color: Color(0xFFE040FB))),
            ),
            const SizedBox(height: 16),
            Text(widget.companionName,
                style: const TextStyle(color: Colors.white, fontSize: 22,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),

            // Animated waveform placeholder
            AnimatedBuilder(
              animation: _waveController,
              builder: (context, _) {
                return Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(7, (i) {
                    final height = 8 + 24 * (0.3 + 0.7 *
                        ((i % 2 == 0 ? _waveController.value : 1 - _waveController.value)));
                    return Container(
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      width: 6,
                      height: height,
                      decoration: BoxDecoration(
                        color: _muted ? Colors.grey : const Color(0xFFE040FB),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    );
                  }),
                );
              },
            ),

            const Spacer(),

            // ── Controls ──────────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 32),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _ControlButton(
                    icon: _muted ? Icons.mic_off : Icons.mic,
                    label: _muted ? 'Unmute' : 'Mute',
                    color: _muted ? Colors.red : Colors.white,
                    onTap: () => setState(() => _muted = !_muted),
                  ),
                  _ControlButton(
                    icon: Icons.call_end,
                    label: 'End',
                    color: Colors.red,
                    filled: true,
                    onTap: () => context.push('/sessions/${widget.sessionId}/timer',
                        extra: {'userId': widget.userId, 'sessionType': 'AUDIO'}),
                  ),
                  _ControlButton(
                    icon: Icons.timer,
                    label: 'Timer',
                    color: Colors.white,
                    onTap: () => context.push('/sessions/${widget.sessionId}/timer',
                        extra: {'userId': widget.userId, 'sessionType': 'AUDIO'}),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ControlButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final bool filled;
  final VoidCallback onTap;

  const _ControlButton({
    required this.icon,
    required this.label,
    required this.color,
    this.filled = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: filled ? color : Colors.transparent,
              border: Border.all(color: filled ? color : Colors.grey[700]!),
            ),
            child: Icon(icon, color: filled ? Colors.white : color, size: 28),
          ),
          const SizedBox(height: 8),
          Text(label, style: TextStyle(color: Colors.grey[400], fontSize: 12)),
        ],
      ),
    );
  }
}
