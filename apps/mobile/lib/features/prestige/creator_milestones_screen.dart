import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'prestige_provider.dart';

class CreatorMilestonesScreen extends ConsumerWidget {
  final String starId;
  const CreatorMilestonesScreen({super.key, required this.starId});

  static const _milestoneDefinitions = [
    _MilestoneDef(
      type: 'FIRST_100_SUPPORTERS',
      title: '100 Supporters',
      description: 'Reach 100 active supporters',
      icon: Icons.people,
      color: Color(0xFFE040FB),
    ),
    _MilestoneDef(
      type: 'FIRST_LIVE_STREAM',
      title: 'First Live Stream',
      description: 'Host your first live event',
      icon: Icons.live_tv,
      color: Color(0xFFFF7043),
    ),
    _MilestoneDef(
      type: 'GLOBAL_REACH',
      title: 'Global Creator',
      description: 'Reach supporters in 5+ countries',
      icon: Icons.public,
      color: Color(0xFF448AFF),
    ),
    _MilestoneDef(
      type: 'RETENTION_MASTER',
      title: 'Retention Master',
      description: 'Maintain 70%+ supporter retention for 30 days',
      icon: Icons.favorite,
      color: Color(0xFFE91E63),
    ),
    _MilestoneDef(
      type: 'GIFT_MILESTONE',
      title: 'Gift Magnet',
      description: 'Receive 1,000 coins in gifts',
      icon: Icons.card_giftcard,
      color: Color(0xFFFFD700),
    ),
    _MilestoneDef(
      type: 'VERIFIED_CREATOR',
      title: 'Verified Creator',
      description: 'Complete identity verification',
      icon: Icons.verified,
      color: Color(0xFF00BFA5),
    ),
    _MilestoneDef(
      type: 'SEASON_CHAMPION',
      title: 'Season Champion',
      description: 'Finish a season in the top 10 leaderboard',
      icon: Icons.emoji_events,
      color: Color(0xFFFFA000),
    ),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prestigeAsync = ref.watch(prestigeSummaryProvider(starId));

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D0D1A),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text('Creator Milestones',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: prestigeAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFFE040FB))),
        error: (e, _) => Center(child: Text('$e', style: const TextStyle(color: Colors.redAccent))),
        data: (summary) {
          final achievements = (summary['achievements'] as List<dynamic>? ?? [])
              .cast<Map<String, dynamic>>();
          final unlockedTypes = achievements.map((a) => a['achievementType'] as String).toSet();

          final unlocked = _milestoneDefinitions.where((m) => unlockedTypes.contains(m.type)).toList();
          final locked   = _milestoneDefinitions.where((m) => !unlockedTypes.contains(m.type)).toList();

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Progress header
              Container(
                padding: const EdgeInsets.all(16),
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF2D1B4E), Color(0xFF1A0030)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.emoji_events, color: Color(0xFFFFD700), size: 36),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${unlocked.length} / ${_milestoneDefinitions.length} unlocked',
                            style: const TextStyle(
                                color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
                          ),
                          const SizedBox(height: 6),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: _milestoneDefinitions.isEmpty
                                  ? 0
                                  : unlocked.length / _milestoneDefinitions.length,
                              backgroundColor: Colors.white12,
                              valueColor: const AlwaysStoppedAnimation(Color(0xFFFFD700)),
                              minHeight: 6,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              if (unlocked.isNotEmpty) ...[
                const _SectionHeader(title: '✅ Unlocked'),
                const SizedBox(height: 8),
                ...unlocked.map((m) => _MilestoneTile(def: m, unlocked: true,
                    achievement: achievements.firstWhere(
                        (a) => a['achievementType'] == m.type,
                        orElse: () => {}))),
                const SizedBox(height: 20),
              ],

              if (locked.isNotEmpty) ...[
                const _SectionHeader(title: '🔒 Locked'),
                const SizedBox(height: 8),
                ...locked.map((m) => _MilestoneTile(def: m, unlocked: false, achievement: {})),
              ],

              const SizedBox(height: 40),
            ],
          );
        },
      ),
    );
  }
}

class _MilestoneDef {
  final String type;
  final String title;
  final String description;
  final IconData icon;
  final Color color;
  const _MilestoneDef({
    required this.type,
    required this.title,
    required this.description,
    required this.icon,
    required this.color,
  });
}

class _MilestoneTile extends StatelessWidget {
  final _MilestoneDef def;
  final bool unlocked;
  final Map<String, dynamic> achievement;
  const _MilestoneTile({required this.def, required this.unlocked, required this.achievement});

  @override
  Widget build(BuildContext context) {
    final unlockedAt = achievement['unlockedAt'] as String?;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: unlocked ? const Color(0xFF1E1832) : const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: unlocked ? def.color.withOpacity(0.4) : Colors.white12,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: unlocked ? def.color.withOpacity(0.15) : Colors.white12,
            ),
            child: Icon(
              def.icon,
              color: unlocked ? def.color : Colors.white24,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(def.title,
                    style: TextStyle(
                      color: unlocked ? Colors.white : Colors.white54,
                      fontWeight: FontWeight.bold,
                    )),
                const SizedBox(height: 2),
                Text(def.description,
                    style: const TextStyle(color: Colors.white38, fontSize: 12)),
                if (unlocked && unlockedAt != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Unlocked ${_fmt(unlockedAt)}',
                    style: TextStyle(color: def.color, fontSize: 11),
                  ),
                ],
              ],
            ),
          ),
          if (unlocked)
            Icon(Icons.check_circle, color: def.color, size: 20)
          else
            const Icon(Icons.lock_outline, color: Colors.white24, size: 18),
        ],
      ),
    );
  }

  String _fmt(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return iso;
    }
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) => Text(
        title,
        style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 14),
      );
}
