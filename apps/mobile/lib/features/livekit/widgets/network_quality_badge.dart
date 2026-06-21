import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';

/// A compact signal-strength badge that reflects a participant's
/// [ConnectionQuality] (excellent / good / poor / lost).
class NetworkQualityBadge extends StatelessWidget {
  final ConnectionQuality quality;
  final double size;

  const NetworkQualityBadge({
    super.key,
    required this.quality,
    this.size = 16,
  });

  ({Color color, int bars, String label}) get _spec {
    switch (quality) {
      case ConnectionQuality.excellent:
        return (color: const Color(0xFF00E676), bars: 3, label: 'Excellent');
      case ConnectionQuality.good:
        return (color: const Color(0xFFFFD600), bars: 2, label: 'Good');
      case ConnectionQuality.poor:
        return (color: const Color(0xFFFF6D00), bars: 1, label: 'Poor');
      case ConnectionQuality.lost:
        return (color: Colors.red, bars: 0, label: 'Lost');
      default:
        return (color: Colors.grey, bars: 0, label: 'Unknown');
    }
  }

  @override
  Widget build(BuildContext context) {
    final spec = _spec;
    return Tooltip(
      message: 'Network: ${spec.label}',
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: Colors.black54,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: List.generate(3, (i) {
            final active = i < spec.bars;
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 0.5),
              width: size * 0.18,
              height: size * (0.4 + 0.2 * i),
              decoration: BoxDecoration(
                color: active ? spec.color : Colors.white24,
                borderRadius: BorderRadius.circular(1),
              ),
            );
          }),
        ),
      ),
    );
  }
}
