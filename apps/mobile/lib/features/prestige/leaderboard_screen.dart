import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'prestige_provider.dart';

class LeaderboardScreen extends ConsumerStatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  ConsumerState<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends ConsumerState<LeaderboardScreen> {
  String _category = 'MOST_GIFTED';
  String _period = 'WEEKLY';

  static const _categories = [
    ('Most Gifted',       'MOST_GIFTED'),
    ('Most Supporters',   'MOST_SUPPORTERS'),
    ('Most Watched',      'MOST_WATCHED'),
    ('Fastest Rising',    'FASTEST_RISING'),
    ('Best Live',         'BEST_LIVE_PERFORMER'),
  ];

  static const _periods = [
    ('Weekly',   'WEEKLY'),
    ('Monthly',  'MONTHLY'),
    ('All Time', 'ALL_TIME'),
  ];

  @override
  Widget build(BuildContext context) {
    final boardAsync = ref.watch(leaderboardProvider((_category, _period)));

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D0D1A),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text('Leaderboards', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: Column(
        children: [
          // Category selector
          SizedBox(
            height: 44,
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              scrollDirection: Axis.horizontal,
              children: _categories.map((c) {
                final selected = _category == c.$2;
                return GestureDetector(
                  onTap: () => setState(() => _category = c.$2),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    decoration: BoxDecoration(
                      color: selected ? const Color(0xFFE040FB) : const Color(0xFF1A1A2E),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: selected ? const Color(0xFFE040FB) : Colors.white24),
                    ),
                    child: Text(c.$1,
                        style: TextStyle(
                          color: selected ? Colors.white : Colors.white54,
                          fontSize: 13,
                          fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                        )),
                  ),
                );
              }).toList(),
            ),
          ),

          // Period selector
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Row(
              children: _periods.map((p) {
                final selected = _period == p.$2;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _period = p.$2),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      margin: const EdgeInsets.only(right: 6),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: selected ? const Color(0xFF1A1A2E) : Colors.transparent,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: selected ? const Color(0xFFFFD700) : Colors.white24),
                      ),
                      child: Center(
                        child: Text(p.$1,
                            style: TextStyle(
                              color: selected ? const Color(0xFFFFD700) : Colors.white38,
                              fontSize: 12,
                              fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                            )),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),

          const Divider(color: Colors.white12),

          // Leaderboard list
          Expanded(
            child: boardAsync.when(
              loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFFFFD700))),
              error: (e, _) => Center(child: Text('$e', style: const TextStyle(color: Colors.redAccent))),
              data: (entries) {
                if (entries.isEmpty) {
                  return const Center(
                    child: Text('No creators on the board yet',
                        style: TextStyle(color: Colors.white38, fontSize: 14)),
                  );
                }
                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: entries.length,
                  itemBuilder: (ctx, i) => _LeaderboardRow(entry: entries[i], index: i),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _LeaderboardRow extends StatelessWidget {
  final Map<String, dynamic> entry;
  final int index;
  const _LeaderboardRow({required this.entry, required this.index});

  @override
  Widget build(BuildContext context) {
    final rank = (entry['rank'] as num?)?.toInt() ?? (index + 1);
    final name = entry['displayName'] as String? ?? 'Creator';
    final score = (entry['score'] as num?)?.toInt() ?? 0;
    final halfStars = (entry['halfStars'] as num?)?.toInt() ?? 1;
    final tierLabel = entry['tierLabel'] as String? ?? '';

    final rankColor = rank == 1
        ? const Color(0xFFFFD700)
        : rank == 2
            ? Colors.grey[300]!
            : rank == 3
                ? const Color(0xFFCD7F32)
                : Colors.white54;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: rank <= 3 ? const Color(0xFF1E1832) : const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: rank <= 3 ? rankColor.withOpacity(0.4) : Colors.white12,
        ),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 36,
            child: Text(
              rank <= 3 ? ['🥇','🥈','🥉'][rank - 1] : '#$rank',
              style: TextStyle(color: rankColor, fontWeight: FontWeight.bold, fontSize: rank <= 3 ? 20 : 14),
            ),
          ),
          const SizedBox(width: 10),
          CircleAvatar(
            radius: 18,
            backgroundColor: const Color(0xFFE040FB).withOpacity(0.2),
            child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
                style: const TextStyle(color: Color(0xFFE040FB), fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                if (tierLabel.isNotEmpty)
                  Text(tierLabel, style: const TextStyle(color: Colors.white38, fontSize: 11)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('$score', style: const TextStyle(color: Color(0xFFFFD700), fontWeight: FontWeight.bold)),
              _TinyStars(halfStars: halfStars),
            ],
          ),
        ],
      ),
    );
  }
}

class _TinyStars extends StatelessWidget {
  final int halfStars;
  const _TinyStars({required this.halfStars});

  @override
  Widget build(BuildContext context) {
    final full = halfStars ~/ 2;
    final hasHalf = halfStars % 2 == 1;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) {
        if (i < full) return const Icon(Icons.star, color: Color(0xFFFFD700), size: 11);
        if (i == full && hasHalf) return const Icon(Icons.star_half, color: Color(0xFFFFD700), size: 11);
        return const Icon(Icons.star_border, color: Colors.white24, size: 11);
      }),
    );
  }
}
