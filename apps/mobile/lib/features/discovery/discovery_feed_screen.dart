import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'discovery_models.dart';
import 'discovery_providers.dart';
import 'discovery_repository.dart';

/// Discovery matrix:
///   • horizontal swipe (genre chips / PageView) → genre switching
///   • vertical swipe (PageView) → more content in the same genre
class DiscoveryFeedScreen extends ConsumerStatefulWidget {
  const DiscoveryFeedScreen({super.key});

  @override
  ConsumerState<DiscoveryFeedScreen> createState() => _DiscoveryFeedScreenState();
}

class _DiscoveryFeedScreenState extends ConsumerState<DiscoveryFeedScreen> {
  @override
  Widget build(BuildContext context) {
    final genresAsync = ref.watch(genresProvider);
    final selectedGenre = ref.watch(selectedGenreProvider);
    final feedAsync = ref.watch(feedProvider(selectedGenre));

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            // ── Genre rail (horizontal swipe) ───────────────────────────────
            SizedBox(
              height: 48,
              child: genresAsync.when(
                data: (genres) => ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: genres.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final g = genres[i];
                    final selected = g.genre == selectedGenre;
                    return Center(
                      child: ChoiceChip(
                        label: Text(g.label),
                        selected: selected,
                        onSelected: (_) => ref.read(selectedGenreProvider.notifier).state = g.genre,
                      ),
                    );
                  },
                ),
                loading: () => const Center(child: LinearProgressIndicator()),
                error: (e, _) => Center(child: Text('Genres failed: $e', style: const TextStyle(color: Colors.white))),
              ),
            ),
            // ── Vertical feed ───────────────────────────────────────────────
            Expanded(
              child: feedAsync.when(
                data: (items) => items.isEmpty
                    ? const Center(child: Text('No content yet', style: TextStyle(color: Colors.white70)))
                    : RefreshIndicator(
                        onRefresh: () async => ref.invalidate(feedProvider(selectedGenre)),
                        child: PageView.builder(
                          scrollDirection: Axis.vertical,
                          itemCount: items.length,
                          itemBuilder: (_, i) => _VideoTile(item: items[i]),
                        ),
                      ),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('Feed failed: $e', style: const TextStyle(color: Colors.white))),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VideoTile extends ConsumerStatefulWidget {
  final DiscoveryItem item;
  const _VideoTile({required this.item});

  @override
  ConsumerState<_VideoTile> createState() => _VideoTileState();
}

class _VideoTileState extends ConsumerState<_VideoTile> {
  String? _watchId;
  int _seconds = 0;
  bool _tapped = false;

  @override
  void initState() {
    super.initState();
    _beginWatch();
  }

  Future<void> _beginWatch() async {
    try {
      final repo = ref.read(discoveryRepositoryProvider);
      _watchId = await repo.startWatch(widget.item.videoId);
    } catch (_) {/* unauthenticated / offline — ignore for MVP */}
  }

  @override
  void dispose() {
    _completeWatch();
    super.dispose();
  }

  Future<void> _completeWatch() async {
    final id = _watchId;
    if (id == null) return;
    try {
      await ref.read(discoveryRepositoryProvider).completeWatch(id, _seconds.clamp(1, 600), 60);
    } catch (_) {}
  }

  Future<void> _sendTap() async {
    setState(() => _tapped = true);
    try {
      await ref.read(discoveryRepositoryProvider).tap(widget.item.videoId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tapped!'), duration: Duration(milliseconds: 600)));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Tap rejected: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    return GestureDetector(
      onDoubleTap: _sendTap,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (item.thumbnailUrl != null)
            CachedNetworkImage(imageUrl: item.thumbnailUrl!, fit: BoxFit.cover, errorWidget: (_, __, ___) => const ColoredBox(color: Colors.black))
          else
            const ColoredBox(color: Colors.black87),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black87]),
            ),
          ),
          Positioned(
            left: 16, right: 16, bottom: 24,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.title, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text('${item.genre} · ${item.viewCount} views · ${item.tapCount} taps',
                    style: const TextStyle(color: Colors.white70, fontSize: 12)),
              ],
            ),
          ),
          Positioned(
            right: 16, bottom: 90,
            child: Column(
              children: [
                IconButton(
                  iconSize: 40,
                  onPressed: _sendTap,
                  icon: Icon(Icons.favorite, color: _tapped ? Colors.pinkAccent : Colors.white),
                ),
                Text('${item.tapCount}', style: const TextStyle(color: Colors.white)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
