import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'arenas_provider.dart';
import 'battle_models.dart';

class LeaderboardScreenV2 extends ConsumerStatefulWidget {
  const LeaderboardScreenV2({super.key});

  @override
  ConsumerState<LeaderboardScreenV2> createState() => _LeaderboardScreenV2State();
}

class _LeaderboardScreenV2State extends ConsumerState<LeaderboardScreenV2> {
  String? _selectedDivision;

  static const _divisions = ['ALL', 'LEGEND', 'DIAMOND', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE'];

  static const _divisionColors = {
    'LEGEND':   Color(0xFFFF6B35),
    'DIAMOND':  Color(0xFF64B5F6),
    'PLATINUM': Color(0xFFB0BEC5),
    'GOLD':     Color(0xFFFFD700),
    'SILVER':   Color(0xFF9E9E9E),
    'BRONZE':   Color(0xFFCD7F32),
  };

  static const _divisionIcons = {
    'LEGEND':   Icons.whatshot,
    'DIAMOND':  Icons.diamond,
    'PLATINUM': Icons.star,
    'GOLD':     Icons.emoji_events,
    'SILVER':   Icons.military_tech,
    'BRONZE':   Icons.shield,
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    ref.read(leaderboardProvider.notifier).load(
      division: (_selectedDivision == 'ALL' || _selectedDivision == null) ? null : _selectedDivision,
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(leaderboardProvider);

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text('Arena Leaderboard', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh, color: Colors.white54), onPressed: _load),
        ],
      ),
      body: Column(
        children: [
          // Division filter chips
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: _divisions.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (ctx, i) {
                final d = _divisions[i];
                final selected = (_selectedDivision ?? 'ALL') == d;
                final color = d == 'ALL' ? Colors.amber : (_divisionColors[d] ?? Colors.white);
                return ChoiceChip(
                  label: Text(d, style: TextStyle(color: selected ? Colors.black : color, fontWeight: FontWeight.bold, fontSize: 11)),
                  selected: selected,
                  selectedColor: color,
                  backgroundColor: Colors.grey[900],
                  side: BorderSide(color: color.withOpacity(0.5)),
                  onSelected: (_) {
                    setState(() => _selectedDivision = d);
                    _load();
                  },
                );
              },
            ),
          ),
          const SizedBox(height: 8),

          // List
          Expanded(
            child: state.when(
              loading: () => const Center(child: CircularProgressIndicator(color: Colors.amber)),
              error: (e, _) => Center(child: Text('$e', style: const TextStyle(color: Colors.red))),
              data: (entries) {
                if (entries.isEmpty) {
                  return const Center(child: Text('No rankings yet', style: TextStyle(color: Colors.white38)));
                }
                return ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: entries.length,
                  separatorBuilder: (_, __) => const Divider(color: Colors.white12, height: 1),
                  itemBuilder: (ctx, i) => _LeaderboardRow(entry: entries[i], divisionColors: _divisionColors, divisionIcons: _divisionIcons),
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
  final CreatorEloEntry entry;
  final Map<String, Color> divisionColors;
  final Map<String, IconData> divisionIcons;

  const _LeaderboardRow({required this.entry, required this.divisionColors, required this.divisionIcons});

  @override
  Widget build(BuildContext context) {
    final divColor = divisionColors[entry.division.name] ?? Colors.white;
    final divIcon = divisionIcons[entry.division.name] ?? Icons.shield;
    final isTop3 = entry.rank <= 3;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          // Rank
          SizedBox(
            width: 40,
            child: isTop3
                ? Icon([Icons.looks_one, Icons.looks_two, Icons.looks_3][entry.rank - 1], color: Colors.amber, size: 28)
                : Text('#${entry.rank}', style: const TextStyle(color: Colors.white38, fontWeight: FontWeight.bold, fontSize: 15), textAlign: TextAlign.center),
          ),
          const SizedBox(width: 12),

          // Avatar
          const CircleAvatar(radius: 22, backgroundColor: Colors.grey, child: Icon(Icons.person, color: Colors.white)),
          const SizedBox(width: 12),

          // Name + division
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(entry.starProfileId.substring(0, 10), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                Row(children: [
                  Icon(divIcon, color: divColor, size: 14),
                  const SizedBox(width: 4),
                  Text(entry.division.name, style: TextStyle(color: divColor, fontSize: 12, fontWeight: FontWeight.bold)),
                ]),
              ],
            ),
          ),

          // Stats
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('${entry.elo} ELO', style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold, fontSize: 15)),
              Text('${entry.wins}W / ${entry.losses}L', style: const TextStyle(color: Colors.white38, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }
}
