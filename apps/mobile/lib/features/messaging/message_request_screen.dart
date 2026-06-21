import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../../core/config/app_config.dart';
import 'messaging_provider.dart';

class MessageRequestScreen extends ConsumerWidget {
  final String userId;
  const MessageRequestScreen({super.key, required this.userId});

  Future<void> _accept(BuildContext context, WidgetRef ref, String requestId) async {
    await http.post(
      Uri.parse('${AppConfig.apiBase}/messages/accept'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'requestId': requestId, 'recipientId': userId}),
    );
    ref.invalidate(pendingRequestsProvider(userId));
  }

  Future<void> _decline(BuildContext context, WidgetRef ref, String requestId) async {
    await http.post(
      Uri.parse('${AppConfig.apiBase}/messages/decline'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'requestId': requestId, 'recipientId': userId}),
    );
    ref.invalidate(pendingRequestsProvider(userId));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(pendingRequestsProvider(userId));
    return Scaffold(
      appBar: AppBar(title: const Text('Message Requests')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (requests) {
          if (requests.isEmpty) {
            return const Center(child: Text('No pending requests'));
          }
          return ListView.separated(
            itemCount: requests.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final r = requests[i];
              return Card(
                margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          CircleAvatar(child: Text(r.senderId[0].toUpperCase())),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(r.senderId,
                                    style: const TextStyle(fontWeight: FontWeight.bold)),
                                Text(r.senderPatronTier,
                                    style: const TextStyle(fontSize: 12, color: Colors.grey)),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.surfaceVariant,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(r.openingMessage),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () => _decline(context, ref, r.id),
                              child: const Text('Decline'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: FilledButton(
                              onPressed: () => _accept(context, ref, r.id),
                              child: const Text('Accept'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
