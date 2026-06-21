import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'events_provider.dart';

class EventDetailScreen extends ConsumerWidget {
  final String eventId;
  const EventDetailScreen({super.key, required this.eventId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventAsync = ref.watch(eventDetailProvider(eventId));

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D1A),
      body: eventAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFFE040FB))),
        error: (e, _) => Center(child: Text('$e', style: const TextStyle(color: Colors.redAccent))),
        data: (event) => CustomScrollView(
          slivers: [
            SliverAppBar(
              expandedHeight: 240,
              pinned: true,
              backgroundColor: const Color(0xFF0D0D1A),
              flexibleSpace: FlexibleSpaceBar(
                background: event.thumbnailUrl != null
                    ? Image.network(event.thumbnailUrl!, fit: BoxFit.cover)
                    : Container(color: const Color(0xFF252540),
                        child: const Center(child: Icon(Icons.live_tv, size: 64, color: Colors.white24))),
              ),
              leading: IconButton(
                icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
                onPressed: () => context.pop(),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.all(20),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // Status badge
                  if (event.isLive)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE040FB),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('🔴 LIVE NOW',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  const SizedBox(height: 12),
                  // Title
                  Text(event.title,
                      style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  // Creator
                  Row(children: [
                    if (event.starAvatarUrl != null)
                      CircleAvatar(backgroundImage: NetworkImage(event.starAvatarUrl!), radius: 16),
                    const SizedBox(width: 8),
                    Text(event.starDisplayName,
                        style: const TextStyle(color: Colors.white70, fontSize: 15)),
                  ]),
                  const SizedBox(height: 16),
                  // Description
                  if (event.description != null) ...[
                    Text(event.description!,
                        style: const TextStyle(color: Colors.white60, fontSize: 14, height: 1.5)),
                    const SizedBox(height: 16),
                  ],
                  // Actions
                  if (event.isLive)
                    _ActionButton(
                      label: 'Join Live Room',
                      icon: Icons.live_tv,
                      color: const Color(0xFFE040FB),
                      onPressed: () => context.push('/live/$eventId'),
                    )
                  else if (event.hasReplay)
                    _ActionButton(
                      label: 'Watch Replay',
                      icon: Icons.play_circle_outline,
                      color: const Color(0xFF6C63FF),
                      onPressed: () => context.push('/replays/${eventId}'),
                    )
                  else
                    _ActionButton(
                      label: 'Buy Ticket',
                      icon: Icons.confirmation_number_outlined,
                      color: const Color(0xFF00BFA5),
                      onPressed: () => context.push('/events/$eventId/purchase'),
                    ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onPressed;
  const _ActionButton({required this.label, required this.icon, required this.color, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, color: Colors.white),
        label: Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    );
  }
}
