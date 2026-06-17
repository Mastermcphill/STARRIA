import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'search_repository.dart';

const _genres = ['', 'COMEDY', 'AI_MOVIES', 'AI_SERIES', 'MUSIC', 'ANIMALS', 'ANIMATION', 'EDUCATION', 'LIFESTYLE'];

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _q = TextEditingController();
  final _country = TextEditingController();
  String _genre = '';
  Future<List<SearchHit>>? _results;

  void _run() {
    setState(() {
      _results = ref.read(searchRepositoryProvider).search(
            q: _q.text,
            country: _country.text,
            genre: _genre,
          );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Search')),
      body: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _q,
              decoration: const InputDecoration(labelText: 'Title or tag', prefixIcon: Icon(Icons.search)),
              onSubmitted: (_) => _run(),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _country,
                    decoration: const InputDecoration(labelText: 'Country (e.g. NG)'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _genre,
                    decoration: const InputDecoration(labelText: 'Genre'),
                    items: _genres
                        .map((g) => DropdownMenuItem(value: g, child: Text(g.isEmpty ? 'Any' : g)))
                        .toList(),
                    onChanged: (v) => setState(() => _genre = v ?? ''),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            FilledButton(onPressed: _run, child: const Text('Search')),
            const SizedBox(height: 12),
            Expanded(
              child: _results == null
                  ? const Center(child: Text('Search by creator, country, language, genre, or title'))
                  : FutureBuilder<List<SearchHit>>(
                      future: _results,
                      builder: (_, snap) {
                        if (snap.connectionState == ConnectionState.waiting) {
                          return const Center(child: CircularProgressIndicator());
                        }
                        if (snap.hasError) return Center(child: Text('${snap.error}'));
                        final hits = snap.data ?? [];
                        if (hits.isEmpty) return const Center(child: Text('No results'));
                        return ListView.separated(
                          itemCount: hits.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (_, i) {
                            final h = hits[i];
                            return ListTile(
                              leading: h.thumbnailUrl != null
                                  ? Image.network(h.thumbnailUrl!, width: 56, height: 56, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.movie))
                                  : const Icon(Icons.movie),
                              title: Text(h.title),
                              subtitle: Text('${h.genre ?? ''} · ${h.country ?? ''} · score ${h.score.toStringAsFixed(2)}'),
                              onTap: () => context.push('/videos/${h.id}'),
                            );
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
