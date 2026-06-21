import 'package:flutter/material.dart';

/// Small mic/speaking indicator. Animated bars while speaking, a muted icon
/// when the participant's microphone is off.
class SpeakerIndicator extends StatefulWidget {
  final bool isSpeaking;
  final bool isMuted;
  final double size;

  const SpeakerIndicator({
    super.key,
    required this.isSpeaking,
    required this.isMuted,
    this.size = 18,
  });

  @override
  State<SpeakerIndicator> createState() => _SpeakerIndicatorState();
}

class _SpeakerIndicatorState extends State<SpeakerIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    if (widget.isSpeaking) _c.repeat(reverse: true);
  }

  @override
  void didUpdateWidget(covariant SpeakerIndicator old) {
    super.didUpdateWidget(old);
    if (widget.isSpeaking && !_c.isAnimating) {
      _c.repeat(reverse: true);
    } else if (!widget.isSpeaking && _c.isAnimating) {
      _c.stop();
      _c.value = 0;
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final box = widget.size;
    if (widget.isMuted) {
      return Container(
        width: box, height: box,
        decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
        child: Icon(Icons.mic_off, size: box * 0.7, color: Colors.red),
      );
    }

    return Container(
      width: box, height: box,
      decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
      child: widget.isSpeaking
          ? AnimatedBuilder(
              animation: _c,
              builder: (context, _) => Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(3, (i) {
                  final t = (i.isEven ? _c.value : 1 - _c.value);
                  return Container(
                    margin: const EdgeInsets.symmetric(horizontal: 0.5),
                    width: box * 0.13,
                    height: box * (0.3 + 0.5 * t),
                    decoration: BoxDecoration(
                      color: const Color(0xFF00E676),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  );
                }),
              ),
            )
          : Icon(Icons.mic, size: box * 0.7, color: Colors.white),
    );
  }
}
