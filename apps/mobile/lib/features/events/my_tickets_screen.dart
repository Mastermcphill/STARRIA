import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'event_models.dart';
import 'events_provider.dart';

class MyTicketsScreen extends ConsumerWidget {
  const MyTicketsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ticketsAsync = ref.watch(myTicketsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D0D1A),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text('My Tickets', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: ticketsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFFE040FB))),
        error: (e, _) => Center(child: Text('$e', style: const TextStyle(color: Colors.redAccent))),
        data: (tickets) {
          if (tickets.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.confirmation_number_outlined, size: 64, color: Colors.white24),
                  SizedBox(height: 16),
                  Text('No tickets yet', style: TextStyle(color: Colors.white54, fontSize: 18)),
                  SizedBox(height: 8),
                  Text('Browse events and grab your first ticket!',
                      style: TextStyle(color: Colors.white38, fontSize: 14)),
                ],
              ),
            );
          }

          return RefreshIndicator(
            color: const Color(0xFFE040FB),
            onRefresh: () => ref.refresh(myTicketsProvider.future),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: tickets.length,
              itemBuilder: (ctx, i) => _TicketCard(ticket: tickets[i]),
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFE040FB),
        onPressed: () => context.push('/events'),
        icon: const Icon(Icons.search, color: Colors.white),
        label: const Text('Browse Events', style: TextStyle(color: Colors.white)),
      ),
    );
  }
}

class _TicketCard extends StatelessWidget {
  final TicketPurchaseModel ticket;
  const _TicketCard({required this.ticket});

  @override
  Widget build(BuildContext context) {
    final event = ticket.event;
    final isLive = event?.isLive ?? false;

    return GestureDetector(
      onTap: () => context.push('/events/${ticket.eventId}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF1A1A2E),
          borderRadius: BorderRadius.circular(16),
          border: isLive ? Border.all(color: const Color(0xFFE040FB)) : null,
        ),
        child: Row(
          children: [
            // Icon
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: isLive
                    ? const Color(0xFFE040FB).withOpacity(0.2)
                    : const Color(0xFF252540),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                isLive ? Icons.live_tv : Icons.confirmation_number_outlined,
                color: isLive ? const Color(0xFFE040FB) : Colors.white54,
                size: 28,
              ),
            ),
            const SizedBox(width: 14),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (isLive) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE040FB),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text('LIVE', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                        ),
                        const SizedBox(width: 6),
                      ],
                      Expanded(
                        child: Text(
                          event?.title ?? ticket.eventId,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${ticket.quantity} ticket${ticket.quantity > 1 ? 's' : ''} · ${ticket.status}',
                    style: const TextStyle(color: Colors.white54, fontSize: 12),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.white38),
          ],
        ),
      ),
    );
  }
}
