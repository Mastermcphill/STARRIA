import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'event_models.dart';
import 'events_provider.dart';

class EventFeedScreen extends ConsumerWidget {
  const EventFeedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(eventListProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D0D1A),
        title: const Text('Live Events', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.confirmation_number_outlined, color: Colors.white),
            onPressed: () => context.push('/tickets/me'),
            tooltip: 'My Tickets',
          ),
        ],
      ),
      body: eventsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFFE040FB))),
        error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: Colors.redAccent))),
        data: (events) {
          if (events.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.live_tv_outlined, size: 64, color: Colors.white24),
                  SizedBox(height: 16),
                  Text('No events yet', style: TextStyle(color: Colors.white54, fontSize: 18)),
                ],
              ),
            );
          }
          return RefreshIndicator(
            color: const Color(0xFFE040FB),
            onRefresh: () => ref.refresh(eventListProvider.future),
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: events.length,
              itemBuilder: (ctx, i) => _EventCard(event: events[i]),
            ),
          );
        },
      ),
    );
  }
}

class _EventCard extends StatelessWidget {
  final EventModel event;
  const _EventCard({required this.event});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/events/${event.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: const Color(0xFF1A1A2E),
          borderRadius: BorderRadius.circular(16),
          border: event.isLive
              ? Border.all(color: const Color(0xFFE040FB), width: 1.5)
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thumbnail
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: event.thumbnailUrl != null
                    ? Image.network(event.thumbnailUrl!, fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const _ThumbnailPlaceholder())
                    : const _ThumbnailPlaceholder(),
              ),
            ),
            // Info
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (event.isLive) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE040FB),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text('LIVE', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                        ),
                        const SizedBox(width: 8),
                      ],
                      Expanded(
                        child: Text(
                          event.title,
                          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.person_outline, size: 14, color: Colors.white54),
                      const SizedBox(width: 4),
                      Text(event.starDisplayName,
                          style: const TextStyle(color: Colors.white54, fontSize: 13)),
                      const Spacer(),
                      _EventTypeBadge(type: event.type),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ThumbnailPlaceholder extends StatelessWidget {
  const _ThumbnailPlaceholder();
  @override
  Widget build(BuildContext context) => Container(
        color: const Color(0xFF252540),
        child: const Center(child: Icon(Icons.live_tv, size: 48, color: Colors.white24)),
      );
}

class _EventTypeBadge extends StatelessWidget {
  final String type;
  const _EventTypeBadge({required this.type});

  static const _labels = {
    'COMEDY_SHOW': '😂 Comedy',
    'RAP_BATTLE': '🎤 Rap Battle',
    'AI_PREMIERE': '🤖 AI Premiere',
    'SING_OFF': '🎵 Sing-Off',
    'CREATOR_QA': '❓ Q&A',
    'YAP_BATTLE': '🗣️ Yap Battle',
    'SUPPORTER_ROOM': '💜 Supporters',
    'LIVE_STREAM': '📡 Live',
  };

  @override
  Widget build(BuildContext context) {
    return Text(
      _labels[type] ?? type,
      style: const TextStyle(color: Color(0xFFE040FB), fontSize: 12),
    );
  }
}
