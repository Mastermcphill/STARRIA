import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'arenas_provider.dart';
import 'battle_models.dart';

class ArenaLobbyScreen extends ConsumerStatefulWidget {
  const ArenaLobbyScreen({super.key});

  @override
  ConsumerState<ArenaLobbyScreen> createState() => _ArenaLobbyScreenState();
}

class _ArenaLobbyScreenState extends ConsumerState<ArenaLobbyScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  String? _selectedType;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _load();
  }

  void _load() {
    ref.read(battlesProvider.notifier).load(status: 'REGISTRATION');
    ref.read(housesProvider.notifier).load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Color _typeColor(BattleType type) {
    switch (type) {
      case BattleType.RAP_BATTLE:     return Colors.purple;
      case BattleType.SING_OFF:       return Colors.pink;
      case BattleType.COMEDY_CLASH:   return Colors.orange;
      case BattleType.YAP_BATTLE:     return Colors.teal;
      case BattleType.AI_FILM_BATTLE: return Colors.blue;
      case BattleType.CREATOR_DUEL:   return Colors.red;
      case BattleType.TEAM_BATTLE:    return Colors.green;
    }
  }

  String _typeLabel(BattleType type) => type.name.replaceAll('_', ' ');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text('Arena', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.leaderboard, color: Colors.amber),
            onPressed: () => context.push('/arenas/leaderboard'),
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white54),
            onPressed: _load,
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          labelColor: Colors.amber,
          unselectedLabelColor: Colors.white38,
          indicatorColor: Colors.amber,
          tabs: const [
            Tab(text: 'LIVE'),
            Tab(text: 'UPCOMING'),
            Tab(text: 'HOUSES'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _BattleTab(status: 'ACTIVE', typeColor: _typeColor, typeLabel: _typeLabel),
          _BattleTab(status: 'REGISTRATION', typeColor: _typeColor, typeLabel: _typeLabel),
          _HousesTab(),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: Colors.amber,
        icon: const Icon(Icons.add, color: Colors.black),
        label: const Text('Create Battle', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
        onPressed: () => context.push('/arenas/create'),
      ),
    );
  }
}

class _BattleTab extends ConsumerWidget {
  final String status;
  final Color Function(BattleType) typeColor;
  final String Function(BattleType) typeLabel;

  const _BattleTab({required this.status, required this.typeColor, required this.typeLabel});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(battlesProvider);
    return state.when(
      loading: () => const Center(child: CircularProgressIndicator(color: Colors.amber)),
      error: (e, _) => Center(child: Text('$e', style: const TextStyle(color: Colors.red))),
      data: (battles) {
        final filtered = battles.where((b) => b.status.name == status).toList();
        if (filtered.isEmpty) {
          return Center(child: Text('No $status battles', style: const TextStyle(color: Colors.white38)));
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: filtered.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (ctx, i) {
            final b = filtered[i];
            final color = typeColor(b.type);
            return InkWell(
              onTap: () => context.push('/arenas/battle/${b.id}'),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.grey[900],
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: color.withOpacity(0.5)),
                ),
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      width: 48, height: 48,
                      decoration: BoxDecoration(color: color.withOpacity(0.2), shape: BoxShape.circle),
                      child: Icon(Icons.mic, color: color),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(b.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                          const SizedBox(height: 4),
                          Row(children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(color: color.withOpacity(0.2), borderRadius: BorderRadius.circular(4)),
                              child: Text(typeLabel(b.type), style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold)),
                            ),
                            const SizedBox(width: 8),
                            Text('${b.participants.length} participants', style: const TextStyle(color: Colors.white38, fontSize: 12)),
                          ]),
                        ],
                      ),
                    ),
                    if (b.prizePool != null)
                      Column(children: [
                        const Icon(Icons.emoji_events, color: Colors.amber, size: 18),
                        Text('${b.prizePool!.totalCoins}', style: const TextStyle(color: Colors.amber, fontSize: 12, fontWeight: FontWeight.bold)),
                      ]),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _HousesTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(housesProvider);
    return state.when(
      loading: () => const Center(child: CircularProgressIndicator(color: Colors.amber)),
      error: (e, _) => Center(child: Text('$e', style: const TextStyle(color: Colors.red))),
      data: (houses) {
        if (houses.isEmpty) {
          return const Center(child: Text('No houses yet', style: TextStyle(color: Colors.white38)));
        }
        return GridView.builder(
          padding: const EdgeInsets.all(16),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, childAspectRatio: 1.1, crossAxisSpacing: 12, mainAxisSpacing: 12),
          itemCount: houses.length,
          itemBuilder: (ctx, i) {
            final h = houses[i];
            return InkWell(
              onTap: () => context.push('/arenas/houses/${h.id}'),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                decoration: BoxDecoration(color: Colors.grey[900], borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.amber.withOpacity(0.3))),
                padding: const EdgeInsets.all(12),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.home, color: Colors.amber, size: 32),
                    const SizedBox(height: 8),
                    Text(h.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold), textAlign: TextAlign.center, maxLines: 2),
                    const SizedBox(height: 4),
                    Text('${h.memberCount} members', style: const TextStyle(color: Colors.white38, fontSize: 12)),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
