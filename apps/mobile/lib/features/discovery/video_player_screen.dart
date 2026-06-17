import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'discovery_models.dart';
import 'discovery_repository.dart';

final _videoProvider = FutureProvider.family<DiscoveryItem, String>((ref, id) async {
  return ref.watch(discoveryRepositoryProvider).getVideo(id);
});

/// Single-video player. The MVP renders the thumbnail as a poster and tracks a
/// watch session; wire `video_player` / `livekit` for real playback later.
class VideoPlayerScreen extends ConsumerStatefulWidget {
  final String videoId;
  const VideoPlayerScreen({super.key, required this.videoId});

  @override
  ConsumerState<VideoPlayerScreen> createState() => _VideoPlayerScreenState();
}

class _VideoPlayerScreenState extends ConsumerState<VideoPlayerScreen> {
  String? _watchId;
  int _seconds = 0;
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    final repo = ref.read(discoveryRepositoryProvider);
    try {
      _watchId = await repo.startWatch(widget.videoId);
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _seconds++);
    } catch (_) {}
  }

  @override
  void dispose() {
    _ticker?.cancel();
    final id = _watchId;
    if (id != null) {
      ref.read(discoveryRepositoryProvider).completeWatch(id, _seconds.clamp(1, 600), 60).ignore();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final videoAsync = ref.watch(_videoProvider(widget.videoId));
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white),
      body: videoAsync.when(
        data: (v) => Stack(
          fit: StackFit.expand,
          children: [
            if (v.thumbnailUrl != null)
              CachedNetworkImage(imageUrl: v.thumbnailUrl!, fit: BoxFit.contain)
            else
              const Center(child: Icon(Icons.play_circle, color: Colors.white24, size: 96)),
            Positioned(
              left: 16, right: 16, bottom: 32,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(v.title, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      FilledButton.icon(
                        onPressed: () async {
                          try {
                            await ref.read(discoveryRepositoryProvider).tap(v.videoId);
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tapped!')));
                            }
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                            }
                          }
                        },
                        icon: const Icon(Icons.favorite),
                        label: const Text('Tap'),
                      ),
                      const SizedBox(width: 12),
                      Text('${v.tapCount} taps', style: const TextStyle(color: Colors.white70)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e', style: const TextStyle(color: Colors.white))),
      ),
    );
  }
}
