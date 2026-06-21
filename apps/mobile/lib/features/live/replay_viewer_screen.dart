import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/api_client.dart';

final replayProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, replayId) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>('/replays/$replayId');
  return res.data!;
});

class ReplayViewerScreen extends ConsumerWidget {
  final String replayId;
  const ReplayViewerScreen({super.key, required this.replayId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final replayAsync = ref.watch(replayProvider(replayId));

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text('Replay', style: TextStyle(color: Colors.white)),
      ),
      body: replayAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFFE040FB))),
        error: (e, _) => Center(child: Text('$e', style: const TextStyle(color: Colors.redAccent))),
        data: (replay) {
          final playbackUrl = replay['playbackUrl'] as String? ?? '';
          final durationSeconds = replay['durationSeconds'] as int? ?? 0;
          final minutes = durationSeconds ~/ 60;
          final seconds = durationSeconds % 60;

          return Column(
            children: [
              // Video player placeholder (integrate video_player package in Sprint 4)
              AspectRatio(
                aspectRatio: 16 / 9,
                child: Container(
                  color: const Color(0xFF0D0D1A),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.play_circle_fill, size: 72, color: Color(0xFFE040FB)),
                      const SizedBox(height: 12),
                      Text(
                        'Replay: ${minutes}m ${seconds}s',
                        style: const TextStyle(color: Colors.white70, fontSize: 14),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        playbackUrl,
                        style: const TextStyle(color: Colors.white38, fontSize: 11),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        replay['title'] as String? ?? 'Live Replay',
                        style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Published ${_formatDate(replay['publishedAt'] as String?)}',
                        style: const TextStyle(color: Colors.white54, fontSize: 13),
                      ),
                      const SizedBox(height: 24),
                      Row(
                        children: [
                          _StatChip(icon: Icons.visibility_outlined, label: '${replay['viewCount'] ?? 0} views'),
                          const SizedBox(width: 12),
                          _StatChip(icon: Icons.timer_outlined, label: '${minutes}m ${seconds}s'),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  String _formatDate(String? iso) {
    if (iso == null) return '';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return iso;
    }
  }
}

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _StatChip({required this.icon, required this.label});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFF1A1A2E),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: Colors.white54),
            const SizedBox(width: 6),
            Text(label, style: const TextStyle(color: Colors.white70, fontSize: 13)),
          ],
        ),
      );
}
