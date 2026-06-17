import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter/material.dart';

import '../../features/discovery/discovery_feed_screen.dart';
import '../../features/discovery/video_player_screen.dart';
import '../../features/search/search_screen.dart';
import '../../features/upload/upload_screen.dart';
import '../../features/creator/creator_profile_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/discovery',
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const _PlaceholderScreen(name: 'Login')),
      GoRoute(path: '/register', builder: (_, __) => const _PlaceholderScreen(name: 'Register')),

      // Sprint 2 — Video Discovery
      GoRoute(path: '/discovery', builder: (_, __) => const DiscoveryFeedScreen()),
      GoRoute(path: '/search', builder: (_, __) => const SearchScreen()),
      GoRoute(path: '/upload', builder: (_, __) => const UploadScreen()),
      GoRoute(
        path: '/videos/:id',
        builder: (_, state) => VideoPlayerScreen(videoId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/creators/:starProfileId',
        builder: (_, state) => CreatorProfileScreen(starProfileId: state.pathParameters['starProfileId']!),
      ),

      // Existing placeholders (other sprints)
      GoRoute(path: '/feed', builder: (_, __) => const _PlaceholderScreen(name: 'Feed')),
      GoRoute(path: '/stars', builder: (_, __) => const _PlaceholderScreen(name: 'Stars')),
      GoRoute(path: '/supporters/me', builder: (_, __) => const _PlaceholderScreen(name: 'Supporter Profile')),
      GoRoute(path: '/events', builder: (_, __) => const _PlaceholderScreen(name: 'Events')),
      GoRoute(path: '/events/:id', builder: (_, __) => const _PlaceholderScreen(name: 'Event Detail')),
      GoRoute(path: '/arenas/:id', builder: (_, __) => const _PlaceholderScreen(name: 'Arena')),
      GoRoute(path: '/ai-creator', builder: (_, __) => const _PlaceholderScreen(name: 'AI Creator')),
    ],
  );
});

class _PlaceholderScreen extends StatelessWidget {
  final String name;
  const _PlaceholderScreen({required this.name});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(name)),
      body: Center(child: Text('$name — TODO', style: Theme.of(context).textTheme.headlineSmall)),
    );
  }
}
