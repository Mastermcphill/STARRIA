import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter/material.dart';

import '../../features/discovery/discovery_feed_screen.dart';
import '../../features/discovery/video_player_screen.dart';
import '../../features/search/search_screen.dart';
import '../../features/upload/upload_screen.dart';
import '../../features/creator/creator_profile_screen.dart';
// Sprint 3 — Live Experience & Ticketing
import '../../features/events/event_feed_screen.dart';
import '../../features/events/event_detail_screen.dart';
import '../../features/events/ticket_purchase_screen.dart';
import '../../features/events/my_tickets_screen.dart';
import '../../features/live/live_room_screen.dart';
import '../../features/live/replay_viewer_screen.dart';
import '../../features/poster/poster_studio_screen.dart';
// Sprint 4 — Prestige & Visibility Marketplace
import '../../features/prestige/prestige_dashboard_screen.dart';
import '../../features/prestige/star_history_screen.dart';
import '../../features/prestige/leaderboard_screen.dart';
import '../../features/prestige/campaign_manager_screen.dart';
import '../../features/prestige/creator_milestones_screen.dart';
// Sprint 5 — Patron Economy, Messaging Prestige & Presence
import '../../features/patron/patron_dashboard_screen.dart';
import '../../features/messaging/inbox_screen.dart';
import '../../features/messaging/conversation_screen.dart';
import '../../features/messaging/message_request_screen.dart';
import '../../features/trust/trust_profile_screen.dart';
import '../../features/presence/presence_settings_screen.dart';
// Sprint 6 — Companion Economy
import '../../features/companion/age_gate_screen.dart';
import '../../features/companion/companion_discovery_screen.dart';
import '../../features/companion/companion_profile_screen.dart';
import '../../features/companion/session_booking_screen.dart';
import '../../features/companion/session_timer_screen.dart';
import '../../features/companion/audio_session_screen.dart';
import '../../features/companion/video_session_screen.dart';
import '../../features/companion/companion_dashboard_screen.dart';
// Sprint 7 — LiveKit Stabilization, Creator OS & Session Engine
import '../../features/live/live_room_screen_v2.dart';
import '../../features/replay/replay_screen.dart';
import '../../features/creator_os/creator_os_dashboard.dart';
import '../../features/creator_os/poster_studio_screen.dart';
import '../../features/creator_os/show_planner_screen.dart';
import '../../features/creator_os/revenue_analytics_screen.dart';
import '../../features/creator_os/recording_manager_screen.dart';
// Sprint 8 — Arenas, Battles & Creator Leagues
import '../../features/arenas/arena_lobby_screen.dart';
import '../../features/arenas/battle_room_screen.dart';
import '../../features/arenas/voting_screen.dart';
import '../../features/arenas/leaderboard_screen_v2.dart';
import '../../features/arenas/house_profile_screen.dart';
import '../../features/arenas/prize_pool_screen.dart';
import '../../features/arenas/arena_history_screen.dart';

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

      // Sprint 3 — Live Experience & Ticketing Economy
      GoRoute(path: '/events', builder: (_, __) => const EventFeedScreen()),
      GoRoute(
        path: '/events/:id',
        builder: (_, state) => EventDetailScreen(eventId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/events/:id/purchase',
        builder: (_, state) => TicketPurchaseScreen(eventId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/tickets/me', builder: (_, __) => const MyTicketsScreen()),
      GoRoute(
        path: '/live/:id',
        builder: (_, state) => LiveRoomScreen(eventId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/replays/:id',
        builder: (_, state) => ReplayViewerScreen(replayId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/poster-studio', builder: (_, __) => const PosterStudioScreen()),

      // Sprint 4 — Prestige & Visibility Marketplace
      GoRoute(
        path: '/prestige/:starId',
        builder: (_, state) => PrestigeDashboardScreen(starId: state.pathParameters['starId']!),
      ),
      GoRoute(
        path: '/prestige/:starId/history',
        builder: (_, state) => StarHistoryScreen(starId: state.pathParameters['starId']!),
      ),
      GoRoute(
        path: '/prestige/:starId/milestones',
        builder: (_, state) => CreatorMilestonesScreen(starId: state.pathParameters['starId']!),
      ),
      GoRoute(path: '/leaderboards', builder: (_, __) => const LeaderboardScreen()),
      GoRoute(
        path: '/campaigns/:starId',
        builder: (_, state) => CampaignManagerScreen(starId: state.pathParameters['starId']!),
      ),

      // Sprint 5 — Patron Economy, Messaging Prestige & Presence
      GoRoute(
        path: '/patrons/:userId',
        builder: (_, state) => PatronDashboardScreen(userId: state.pathParameters['userId']!),
      ),
      GoRoute(
        path: '/inbox/:userId',
        builder: (_, state) => InboxScreen(userId: state.pathParameters['userId']!),
      ),
      GoRoute(
        path: '/conversations/:id',
        builder: (_, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return ConversationScreen(
            conversationId: state.pathParameters['id']!,
            currentUserId: extra?['userId'] as String? ?? '',
          );
        },
      ),
      GoRoute(
        path: '/messages/requests/:userId',
        builder: (_, state) => MessageRequestScreen(userId: state.pathParameters['userId']!),
      ),
      GoRoute(
        path: '/trust/:userId',
        builder: (_, state) => TrustProfileScreen(userId: state.pathParameters['userId']!),
      ),
      GoRoute(
        path: '/presence/:userId',
        builder: (_, state) => PresenceSettingsScreen(userId: state.pathParameters['userId']!),
      ),

      // Sprint 6 — Companion Economy
      GoRoute(
        path: '/companion/gate/:userId',
        builder: (_, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return AgeGateScreen(
            userId: state.pathParameters['userId']!,
            destination: extra?['destination'] as String? ?? '/companion/discovery/${state.pathParameters['userId']}',
          );
        },
      ),
      GoRoute(
        path: '/companion/discovery/:userId',
        builder: (_, state) => CompanionDiscoveryScreen(userId: state.pathParameters['userId']!),
      ),
      GoRoute(
        path: '/companion/dashboard/:userId',
        builder: (_, state) => CompanionDashboardScreen(userId: state.pathParameters['userId']!),
      ),
      GoRoute(
        path: '/companion/:id',
        builder: (_, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return CompanionProfileScreen(
            companionId: state.pathParameters['id']!,
            userId: extra?['userId'] as String? ?? '',
          );
        },
      ),
      GoRoute(
        path: '/companion/:id/book',
        builder: (_, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return SessionBookingScreen(
            companionId: state.pathParameters['id']!,
            userId: extra?['userId'] as String? ?? '',
          );
        },
      ),
      GoRoute(
        path: '/sessions/:id/timer',
        builder: (_, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return SessionTimerScreen(
            sessionId: state.pathParameters['id']!,
            userId: extra?['userId'] as String? ?? '',
            sessionType: extra?['sessionType'] as String? ?? 'AUDIO',
          );
        },
      ),
      GoRoute(
        path: '/sessions/:id/audio',
        builder: (_, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return AudioSessionScreen(
            sessionId: state.pathParameters['id']!,
            userId: extra?['userId'] as String? ?? '',
            companionName: extra?['companionName'] as String? ?? 'Companion',
          );
        },
      ),
      GoRoute(
        path: '/sessions/:id/video',
        builder: (_, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return VideoSessionScreen(
            sessionId: state.pathParameters['id']!,
            userId: extra?['userId'] as String? ?? '',
            companionName: extra?['companionName'] as String? ?? 'Companion',
          );
        },
      ),

      // Sprint 7 — LiveKit Stabilization, Creator OS & Session Engine
      GoRoute(
        path: '/live-v2/:roomId',
        builder: (_, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return LiveRoomScreenV2(
            roomId: state.pathParameters['roomId']!,
            userId: extra?['userId'] as String? ?? '',
            isHost: extra?['isHost'] as bool? ?? false,
          );
        },
      ),
      GoRoute(
        path: '/replays/:id/watch',
        builder: (_, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return ReplayScreen(
            replayId: state.pathParameters['id']!,
            userId: extra?['userId'] as String? ?? 'anonymous',
          );
        },
      ),
      GoRoute(
        path: '/creator-os/:creatorId',
        builder: (_, state) => CreatorOSDashboard(creatorId: state.pathParameters['creatorId']!),
      ),
      GoRoute(
        path: '/creator-os/:creatorId/poster',
        builder: (_, state) => CreatorPosterStudioScreen(creatorId: state.pathParameters['creatorId']!),
      ),
      GoRoute(
        path: '/creator-os/:creatorId/show-planner',
        builder: (_, state) => ShowPlannerScreen(creatorId: state.pathParameters['creatorId']!),
      ),
      GoRoute(
        path: '/creator-os/:creatorId/analytics',
        builder: (_, state) => RevenueAnalyticsScreen(creatorId: state.pathParameters['creatorId']!),
      ),
      GoRoute(
        path: '/creator-os/:creatorId/recordings',
        builder: (_, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return RecordingManagerScreen(
            creatorId: state.pathParameters['creatorId']!,
            roomId: extra?['roomId'] as String? ?? '',
          );
        },
      ),

      // Sprint 8 — Arenas, Battles & Creator Leagues
      GoRoute(path: '/arenas', builder: (_, __) => const ArenaLobbyScreen()),
      GoRoute(path: '/arenas/leaderboard', builder: (_, __) => const LeaderboardScreenV2()),
      GoRoute(path: '/arenas/history', builder: (_, __) => const ArenaHistoryScreen()),
      GoRoute(path: '/arenas/create', builder: (_, __) => const _PlaceholderScreen(name: 'Create Battle')),
      GoRoute(path: '/arenas/houses', builder: (_, __) => const ArenaLobbyScreen()),
      GoRoute(
        path: '/arenas/houses/:id',
        builder: (_, state) => HouseProfileScreen(houseId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/arenas/battle/:id',
        builder: (_, state) => BattleRoomScreen(battleId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/arenas/battle/:id/vote',
        builder: (_, state) => VotingScreen(battleId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/arenas/battle/:id/prize-pool',
        builder: (_, state) => PrizePoolScreen(battleId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/arenas/battle/:id/history',
        builder: (_, state) => const ArenaHistoryScreen(),
      ),

      // Existing placeholders
      GoRoute(path: '/feed', builder: (_, __) => const _PlaceholderScreen(name: 'Feed')),
      GoRoute(path: '/stars', builder: (_, __) => const _PlaceholderScreen(name: 'Stars')),
      GoRoute(path: '/supporters/me', builder: (_, __) => const _PlaceholderScreen(name: 'Supporter Profile')),
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
