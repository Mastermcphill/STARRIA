import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../search/search_repository.dart';

/// Creator profile — header + grid of the creator's published videos.
/// Videos are fetched via the search index filtered by creatorId (starProfileId).
class CreatorProfileScreen extends ConsumerWidget {
  final String starProfileId;
  const CreatorProfileScreen({super.key, required this.starProfileId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final videos = ref.watch(_creatorVideosProvider(starProfileId));
    return Scaffold(
      appBar: AppBar(title: const Text('Creator')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(radius: 32, child: Text(starProfileId.substring(0, 2).toUpperCase())),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Star $starProfileId', style: Theme.of(context).textTheme.titleMedium, overflow: TextOverflow.ellipsis),
                      const Text('Creator on STARRIA', style: TextStyle(color: Colors.grey)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: videos.when(
              data: (hits) => hits.isEmpty
                  ? const Center(child: Text('No videos yet'))
                  : GridView.builder(
                      padding: const EdgeInsets.all(8),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3, childAspectRatio: 9 / 16, crossAxisSpacing: 6, mainAxisSpacing: 6,
                      ),
                      itemCount: hits.length,
                      itemBuilder: (_, i) {
                        final h = hits[i];
                        return GestureDetector(
                          onTap: () => context.push('/videos/${h.id}'),
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              if (h.thumbnailUrl != null)
                                Image.network(h.thumbnailUrl!, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const ColoredBox(color: Colors.black12))
                              else
                                const ColoredBox(color: Colors.black12, child: Icon(Icons.movie)),
                              Positioned(
                                left: 4, right: 4, bottom: 4,
                                child: Text(h.title, maxLines: 1, overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(color: Colors.white, fontSize: 11, shadows: [Shadow(blurRadius: 4)])),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('$e')),
            ),
          ),
        ],
      ),
    );
  }
}

final _creatorVideosProvider = FutureProvider.family<List<SearchHit>, String>((ref, starProfileId) async {
  return ref.watch(searchRepositoryProvider).search(creatorId: starProfileId);
});
