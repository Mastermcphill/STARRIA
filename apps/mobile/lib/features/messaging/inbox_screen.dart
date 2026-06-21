import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'messaging_provider.dart';

class InboxScreen extends ConsumerWidget {
  final String userId;
  const InboxScreen({super.key, required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(inboxProvider(userId));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Inbox'),
        actions: [
          IconButton(
            icon: const Icon(Icons.mail_outline),
            tooltip: 'Message Requests',
            onPressed: () => context.push('/messages/requests/$userId'),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (threads) {
          if (threads.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.inbox, size: 64, color: Colors.grey),
                  SizedBox(height: 16),
                  Text('No messages yet'),
                ],
              ),
            );
          }
          return ListView.separated(
            itemCount: threads.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final t = threads[i];
              return ListTile(
                leading: CircleAvatar(child: Text(t.otherUserId[0].toUpperCase())),
                title: Text(t.otherUserId,
                    style: t.unreadCount > 0
                        ? const TextStyle(fontWeight: FontWeight.bold)
                        : null),
                subtitle: Text(
                  t.lastMessage ?? 'No messages',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: t.unreadCount > 0
                    ? Badge(
                        label: Text('${t.unreadCount}'),
                        child: const SizedBox.shrink(),
                      )
                    : null,
                onTap: () => context.push('/conversations/${t.conversationId}',
                    extra: {'userId': userId}),
              );
            },
          );
        },
      ),
    );
  }
}
