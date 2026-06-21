import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'prestige_provider.dart';

class StarHistoryScreen extends ConsumerWidget {
  final String starId;
  const StarHistoryScreen({super.key, required this.starId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(starHistoryProvider(starId));

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D0D1A),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text('Star History', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: historyAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFFFFD700))),
        error: (e, _) => Center(child: Text('$e', style: const TextStyle(color: Colors.redAccent))),
        data: (history) {
          if (history.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.timeline, size: 64, color: Colors.white24),
                  SizedBox(height: 16),
                  Text('No history yet', style: TextStyle(color: Colors.white54, fontSize: 16)),
                  SizedBox(height: 8),
                  Text('Scores are recorded nightly after first recalculation.',
                      style: TextStyle(color: Colors.white38, fontSize: 13),
                      textAlign: TextAlign.center),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: history.length,
            itemBuilder: (ctx, i) {
              final entry = history[history.length - 1 - i]; // newest first
              final score = (entry['score'] as num?)?.toInt() ?? 0;
              final tier = entry['tierLabel'] as String? ?? 'Spark';
              final halfStars = (entry['halfStars'] as num?)?.toInt() ?? 1;
              final recordedAt = _formatDate(entry['recordedAt'] as String?);
              final factors = entry['factors'] as Map<String, dynamic>?;

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1A1A2E),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(tier,
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                            _StarStars(halfStars: halfStars),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('$score pts',
                                style: const TextStyle(
                                    color: Color(0xFFFFD700), fontWeight: FontWeight.bold, fontSize: 18)),
                            Text(recordedAt, style: const TextStyle(color: Colors.white38, fontSize: 11)),
                          ],
                        ),
                      ],
                    ),
                    if (factors != null) ...[
                      const SizedBox(height: 12),
                      _FactorBars(factors: factors),
                    ],
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  String _formatDate(String? iso) {
    if (iso == null) return '';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return iso;
    }
  }
}

class _StarStars extends StatelessWidget {
  final int halfStars;
  const _StarStars({required this.halfStars});

  @override
  Widget build(BuildContext context) {
    final full = halfStars ~/ 2;
    final hasHalf = halfStars % 2 == 1;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) {
        if (i < full) return const Icon(Icons.star, color: Color(0xFFFFD700), size: 14);
        if (i == full && hasHalf) return const Icon(Icons.star_half, color: Color(0xFFFFD700), size: 14);
        return const Icon(Icons.star_border, color: Colors.white24, size: 14);
      }),
    );
  }
}

class _FactorBars extends StatelessWidget {
  final Map<String, dynamic> factors;
  const _FactorBars({required this.factors});

  @override
  Widget build(BuildContext context) {
    final items = [
      ('Supporters',  factors['supporters'],   const Color(0xFFE040FB)),
      ('Gifts',       factors['giftVolume'],    const Color(0xFFFFD700)),
      ('Watch Time',  factors['watchTime'],     const Color(0xFF00BFA5)),
      ('Retention',   factors['retention'],     const Color(0xFF448AFF)),
      ('Tap Velocity',factors['tapVelocity'],   const Color(0xFFFF7043)),
    ];

    return Column(
      children: items.map((item) {
        final val = (item.$2 as num?)?.toInt() ?? 0;
        return Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(
            children: [
              SizedBox(
                width: 80,
                child: Text(item.$1,
                    style: const TextStyle(color: Colors.white38, fontSize: 11)),
              ),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: LinearProgressIndicator(
                    value: (val / 350).clamp(0.0, 1.0),
                    backgroundColor: Colors.white12,
                    valueColor: AlwaysStoppedAnimation(item.$3),
                    minHeight: 5,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              SizedBox(
                width: 28,
                child: Text('$val', style: const TextStyle(color: Colors.white54, fontSize: 11)),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}
