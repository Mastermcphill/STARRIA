import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../../core/config/app_config.dart';

// ── Models ────────────────────────────────────────────────────────────────────

class InboxThread {
  final String conversationId;
  final String otherUserId;
  final String? lastMessage;
  final String? lastMessageAt;
  final int unreadCount;

  const InboxThread({
    required this.conversationId,
    required this.otherUserId,
    this.lastMessage,
    this.lastMessageAt,
    required this.unreadCount,
  });

  factory InboxThread.fromJson(Map<String, dynamic> j) => InboxThread(
        conversationId: j['conversationId'] as String,
        otherUserId: j['otherUserId'] as String,
        lastMessage: j['lastMessage'] as String?,
        lastMessageAt: j['lastMessageAt'] as String?,
        unreadCount: j['unreadCount'] as int,
      );
}

class ChatMessage {
  final String id;
  final String senderId;
  final String body;
  final String type;
  final String sentAt;

  const ChatMessage({
    required this.id,
    required this.senderId,
    required this.body,
    required this.type,
    required this.sentAt,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> j) => ChatMessage(
        id: j['id'] as String,
        senderId: j['senderId'] as String,
        body: j['body'] as String,
        type: j['type'] as String,
        sentAt: j['sentAt'] as String,
      );
}

class MessageRequest {
  final String id;
  final String senderId;
  final String recipientId;
  final String senderPatronTier;
  final String openingMessage;
  final String status;
  final String sentAt;

  const MessageRequest({
    required this.id,
    required this.senderId,
    required this.recipientId,
    required this.senderPatronTier,
    required this.openingMessage,
    required this.status,
    required this.sentAt,
  });

  factory MessageRequest.fromJson(Map<String, dynamic> j) => MessageRequest(
        id: j['id'] as String,
        senderId: j['senderId'] as String,
        recipientId: j['recipientId'] as String,
        senderPatronTier: j['senderPatronTier'] as String,
        openingMessage: j['openingMessage'] as String,
        status: j['status'] as String,
        sentAt: j['sentAt'] as String,
      );
}

// ── Providers ─────────────────────────────────────────────────────────────────

final inboxProvider =
    FutureProvider.autoDispose.family<List<InboxThread>, String>((ref, userId) async {
  final res = await http.get(
    Uri.parse('${AppConfig.apiBase}/inbox?userId=$userId'),
  );
  if (res.statusCode != 200) throw Exception('Failed to load inbox');
  return (jsonDecode(res.body) as List)
      .map((t) => InboxThread.fromJson(t as Map<String, dynamic>))
      .toList();
});

final conversationMessagesProvider =
    FutureProvider.autoDispose.family<List<ChatMessage>, String>((ref, convId) async {
  final res = await http.get(
    Uri.parse('${AppConfig.apiBase}/conversations/$convId/messages'),
  );
  if (res.statusCode != 200) throw Exception('Failed to load messages');
  return (jsonDecode(res.body) as List)
      .map((m) => ChatMessage.fromJson(m as Map<String, dynamic>))
      .toList();
});

final pendingRequestsProvider =
    FutureProvider.autoDispose.family<List<MessageRequest>, String>((ref, recipientId) async {
  final res = await http.get(
    Uri.parse('${AppConfig.apiBase}/messages/requests?recipientId=$recipientId'),
  );
  if (res.statusCode != 200) throw Exception('Failed to load requests');
  return (jsonDecode(res.body) as List)
      .map((r) => MessageRequest.fromJson(r as Map<String, dynamic>))
      .toList();
});
