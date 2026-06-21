import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart' show RTCVideoViewObjectFit;
import 'speaker_indicator.dart';
import 'network_quality_badge.dart';

/// Renders a single participant's video track (or an avatar fallback) with a
/// name label, speaker indicator and network-quality badge.
///
/// This is the production replacement for the non-functional SmartStageView
/// tile: it subscribes to the participant's first subscribed video track and
/// renders it via LiveKit's [VideoTrackRenderer].
class ParticipantTile extends StatelessWidget {
  final Participant participant;
  final bool isLocal;
  final bool showStats;
  final BoxFit fit;

  const ParticipantTile({
    super.key,
    required this.participant,
    this.isLocal = false,
    this.showStats = true,
    this.fit = BoxFit.cover,
  });

  VideoTrack? get _videoTrack {
    for (final pub in participant.videoTrackPublications) {
      if (pub.subscribed && pub.track != null && !pub.muted) {
        return pub.track as VideoTrack;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final track = _videoTrack;
    final name = participant.name.isNotEmpty
        ? participant.name
        : (participant.identity.isNotEmpty ? participant.identity : 'Guest');

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        color: const Color(0xFF1A1A1A),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // ── Video or avatar fallback ──────────────────────────────────────
            if (track != null)
              VideoTrackRenderer(track, fit: fit == BoxFit.cover
                  ? RTCVideoViewObjectFit.RTCVideoViewObjectFitCover
                  : RTCVideoViewObjectFit.RTCVideoViewObjectFitContain)
            else
              Center(
                child: CircleAvatar(
                  radius: 36,
                  backgroundColor: const Color(0xFF2A2A2A),
                  child: Text(
                    name[0].toUpperCase(),
                    style: const TextStyle(fontSize: 30, color: Color(0xFFE040FB)),
                  ),
                ),
              ),

            // ── Active-speaker ring ──────────────────────────────────────────
            if (participant.isSpeaking)
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF00E676), width: 3),
                ),
              ),

            // ── Bottom name + mic state ──────────────────────────────────────
            Positioned(
              left: 6, right: 6, bottom: 6,
              child: Row(
                children: [
                  SpeakerIndicator(
                    isSpeaking: participant.isSpeaking,
                    isMuted: !participant.isMicrophoneEnabled(),
                  ),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        isLocal ? 'You' : name,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white, fontSize: 12),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ── Network quality badge ────────────────────────────────────────
            if (showStats)
              Positioned(
                top: 6, right: 6,
                child: NetworkQualityBadge(quality: participant.connectionQuality),
              ),
          ],
        ),
      ),
    );
  }
}
