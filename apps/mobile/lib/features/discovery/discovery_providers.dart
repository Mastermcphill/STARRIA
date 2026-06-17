import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'discovery_models.dart';
import 'discovery_repository.dart';

/// Genres for the horizontal swipe rail.
final genresProvider = FutureProvider<List<GenreInfo>>((ref) async {
  return ref.watch(discoveryRepositoryProvider).genres();
});

/// Currently selected genre (driven by horizontal swipe).
final selectedGenreProvider = StateProvider<String>((ref) => 'COMEDY');

/// Vertical feed for a genre.
final feedProvider = FutureProvider.family<List<DiscoveryItem>, String>((ref, genre) async {
  return ref.watch(discoveryRepositoryProvider).feed(genre: genre);
});

/// Global trending rail.
final trendingProvider = FutureProvider<List<TrendingItem>>((ref) async {
  return ref.watch(discoveryRepositoryProvider).trending();
});
