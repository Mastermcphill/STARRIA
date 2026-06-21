import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'arenas_provider.dart';
import 'battle_models.dart';

class ArenaHistoryScreen extends ConsumerStatefulWidget {
  const ArenaHistoryScreen({super.key});

  @override
  ConsumerState<ArenaHistoryScreen> createState() => _ArenaHistoryScreenState();
}

class _ArenaHistoryScreenState extends ConsumerState<ArenaHistoryScreen> {
  @override
  void initState() {
    super.initState();
    ref.read(battlesProvider.notifier).load(status: 'SETTLED');
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(battlesProvider);

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text('Battle History', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: state.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Colors.amber)),
        error: (e, _) => Center(child: Text('$e', style: const TextStyle(color: Colors.red))),
        data: (battles) {
          final settled = battles.where((b) => b.status == BattleStatus.SETTLED || b.status == BattleStatus.ARCHIVED).toList();
          if (settled.isEmpty) {
            return const Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.history, color: Colors.white24, size: 64),
                SizedBox(height: 16),
                Text('No completed battles yet', style: TextStyle(color: Colors.white38, fontSize: 16)),
              ]),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: settled.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (ctx, i) {
              final b = settled[i];
              return InkWell(
                onTap: () => context.push('/arenas/battle/${b.id}'),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.grey[900],
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(color: Colors.amber.withOpacity(0.1), shape: BoxShape.circle),
                        child: const Icon(Icons.emoji_events, color: Colors.amber, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(b.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                          const SizedBox(height: 3),
                          Text(b.type.name.replaceAll('_', ' '), style: const TextStyle(color: Colors.white38, fontSize: 12)),
                        ]),
                      ),
                      Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: b.status == BattleStatus.SETTLED ? Colors.blue.withOpacity(0.2) : Colors.grey.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(b.status.name, style: TextStyle(color: b.status == BattleStatus.SETTLED ? Colors.blue : Colors.grey, fontSize: 10, fontWeight: FontWeight.bold)),
                        ),
                        const SizedBox(height: 4),
                        Text('${b.participants.length} fighters', style: const TextStyle(color: Colors.white38, fontSize: 11)),
                      ]),
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
