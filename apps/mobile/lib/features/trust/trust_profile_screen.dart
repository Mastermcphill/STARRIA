import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../../core/config/app_config.dart';

final _trustProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, userId) async {
  final res = await http.get(Uri.parse('${AppConfig.apiBase}/trust/me?userId=$userId'));
  if (res.statusCode != 200) throw Exception('Failed to load trust profile');
  return jsonDecode(res.body) as Map<String, dynamic>;
});

class TrustProfileScreen extends ConsumerWidget {
  final String userId;
  const TrustProfileScreen({super.key, required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_trustProvider(userId));
    return Scaffold(
      appBar: AppBar(title: const Text('Trust Profile')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (data) {
          final profile = data['profile'] as Map<String, dynamic>;
          final eligibility = data['eligibility'] as Map<String, dynamic>;
          final score = profile['score'] as int;
          final signals = profile['signals'] as Map<String, dynamic>;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // ── Score card ──────────────────────────────────────────────────
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Text('Trust Score',
                          style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 16),
                      _ScoreRing(score: score),
                      const SizedBox(height: 16),
                      _EligibilityRow(
                        canMessage: eligibility['canMessage'] as bool,
                        canBePatron: eligibility['canBePatron'] as bool,
                        isShadowRestricted: eligibility['isShadowRestricted'] as bool,
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // ── Signal breakdown ────────────────────────────────────────────
              Text('Signal Breakdown',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              _SignalBar('Moderation', signals['moderationScore'] as int,
                  Colors.green),
              _SignalBar('Fraud Detection', signals['fraudScore'] as int,
                  Colors.blue),
              _SignalBar('Spam Score', signals['spamScore'] as int, Colors.teal),
              _SignalBar('Conversation Quality',
                  signals['conversationQuality'] as int, Colors.purple),
              _SignalBar('Creator Feedback',
                  signals['creatorFeedback'] as int, Colors.orange),
            ],
          );
        },
      ),
    );
  }
}

class _ScoreRing extends StatelessWidget {
  final int score;
  const _ScoreRing({required this.score});

  Color get _color {
    if (score >= 70) return Colors.green;
    if (score >= 40) return Colors.orange;
    return Colors.red;
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 120,
      height: 120,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CircularProgressIndicator(
            value: score / 100,
            strokeWidth: 10,
            backgroundColor: Colors.grey.shade200,
            valueColor: AlwaysStoppedAnimation(_color),
          ),
          Text('$score',
              style:
                  const TextStyle(fontSize: 32, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

class _EligibilityRow extends StatelessWidget {
  final bool canMessage;
  final bool canBePatron;
  final bool isShadowRestricted;
  const _EligibilityRow({
    required this.canMessage,
    required this.canBePatron,
    required this.isShadowRestricted,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _Chip('Messaging', canMessage),
        _Chip('Patron', canBePatron),
        _Chip('Visible', !isShadowRestricted),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final bool ok;
  const _Chip(this.label, this.ok);

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(ok ? Icons.check_circle : Icons.cancel,
          color: ok ? Colors.green : Colors.red, size: 16),
      label: Text(label, style: const TextStyle(fontSize: 12)),
      backgroundColor: ok
          ? Colors.green.withOpacity(0.1)
          : Colors.red.withOpacity(0.1),
    );
  }
}

class _SignalBar extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  const _SignalBar(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label),
              Text('$value / 100',
                  style: const TextStyle(fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: value / 100,
              minHeight: 8,
              backgroundColor: Colors.grey.shade200,
              valueColor: AlwaysStoppedAnimation(color),
            ),
          ),
        ],
      ),
    );
  }
}
