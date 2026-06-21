import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'prestige_provider.dart';

class PrestigeDashboardScreen extends ConsumerWidget {
  final String starId;
  const PrestigeDashboardScreen({super.key, required this.starId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summaryAsync = ref.watch(prestigeSummaryProvider(starId));

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D0D1A),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text('Prestige', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.history, color: Colors.white70),
            onPressed: () => context.push('/prestige/$starId/history'),
          ),
        ],
      ),
      body: summaryAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFFE040FB))),
        error: (e, _) => Center(child: Text('$e', style: const TextStyle(color: Colors.redAccent))),
        data: (summary) {
          final ws = summary['whiteStar'] as Map<String, dynamic>?;
          final gs = summary['goldStar'] as Map<String, dynamic>?;
          final fee = summary['fee'] as Map<String, dynamic>?;
          final achievements = (summary['achievements'] as List<dynamic>? ?? []);

          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // White Star card
                _PrestigeCard(
                  title: '⭐ White Star Rating',
                  accent: const Color(0xFFFFD700),
                  child: ws != null
                      ? _WhiteStarView(ws: ws, starId: starId)
                      : const Text('No rating yet', style: TextStyle(color: Colors.white54)),
                ),
                const SizedBox(height: 16),

                // Gold Star card
                _PrestigeCard(
                  title: '🌟 Gold Star Status',
                  accent: const Color(0xFFFFA000),
                  child: gs != null
                      ? _GoldStarView(gs: gs)
                      : const Text('Not yet earned', style: TextStyle(color: Colors.white54)),
                ),
                const SizedBox(height: 16),

                // Revenue tier card
                if (fee != null)
                  _PrestigeCard(
                    title: '💰 Revenue Tier',
                    accent: const Color(0xFF00BFA5),
                    child: _RevenueView(fee: fee),
                  ),
                const SizedBox(height: 16),

                // Achievements
                _PrestigeCard(
                  title: '🏆 Achievements (${achievements.length})',
                  accent: const Color(0xFFE040FB),
                  child: achievements.isEmpty
                      ? const Text('No achievements yet', style: TextStyle(color: Colors.white54))
                      : Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: achievements.map((a) {
                            final ach = a as Map<String, dynamic>;
                            return Chip(
                              label: Text(ach['title'] as String? ?? '',
                                  style: const TextStyle(color: Colors.white, fontSize: 12)),
                              backgroundColor: const Color(0xFF2D1B4E),
                              side: const BorderSide(color: Color(0xFFE040FB)),
                            );
                          }).toList(),
                        ),
                ),
                const SizedBox(height: 24),

                // Action buttons
                Row(
                  children: [
                    Expanded(
                      child: _ActionButton(
                        label: 'Leaderboards',
                        icon: Icons.leaderboard,
                        onTap: () => context.push('/leaderboards'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _ActionButton(
                        label: 'Campaigns',
                        icon: Icons.campaign,
                        onTap: () => context.push('/campaigns/$starId'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _ActionButton(
                        label: 'Milestones',
                        icon: Icons.flag_outlined,
                        onTap: () => context.push('/prestige/$starId/milestones'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _ActionButton(
                        label: 'Star History',
                        icon: Icons.timeline,
                        onTap: () => context.push('/prestige/$starId/history'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 40),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _WhiteStarView extends ConsumerWidget {
  final Map<String, dynamic> ws;
  final String starId;
  const _WhiteStarView({required this.ws, required this.starId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final halfStars = (ws['halfStars'] as num?)?.toInt() ?? 1;
    final tierLabel = ws['tierLabel'] as String? ?? 'Spark';
    final score = (ws['score'] as num?)?.toInt() ?? 0;
    final uploadStatus = ref.watch(uploadStatusProvider(starId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _StarRating(halfStars: halfStars),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tierLabel,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
                Text('Score: $score', style: const TextStyle(color: Colors.white54, fontSize: 12)),
              ],
            ),
          ],
        ),
        const SizedBox(height: 12),
        uploadStatus.when(
          data: (u) => _UploadBar(used: u['used'] as int, cap: u['cap'] as int),
          loading: () => const SizedBox(height: 8, child: LinearProgressIndicator()),
          error: (_, __) => const SizedBox(),
        ),
      ],
    );
  }
}

class _GoldStarView extends StatelessWidget {
  final Map<String, dynamic> gs;
  const _GoldStarView({required this.gs});

  @override
  Widget build(BuildContext context) {
    final tier = gs['tierLabel'] as String? ?? 'Aurora';
    final score = (gs['score'] as num?)?.toInt() ?? 0;
    final isVerified = gs['isVerified'] as bool? ?? false;

    return Row(
      children: [
        Container(
          width: 48, height: 48,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFFFFA000).withOpacity(0.2),
            border: Border.all(color: const Color(0xFFFFA000)),
          ),
          child: const Center(child: Text('🌟', style: TextStyle(fontSize: 22))),
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(tier,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                if (isVerified) ...[
                  const SizedBox(width: 6),
                  const Icon(Icons.verified, color: Color(0xFF00BFA5), size: 16),
                ],
              ],
            ),
            Text('Gold score: $score', style: const TextStyle(color: Colors.white54, fontSize: 12)),
          ],
        ),
      ],
    );
  }
}

class _RevenueView extends StatelessWidget {
  final Map<String, dynamic> fee;
  const _RevenueView({required this.fee});

  @override
  Widget build(BuildContext context) {
    final feePct = (fee['feePct'] as num?)?.toInt() ?? 50;
    final creatorPct = (fee['creatorPct'] as num?)?.toInt() ?? 50;
    final tier = fee['revenueTier'] as String? ?? 'NEW';

    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(tier,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 4),
              Text('You keep $creatorPct% · Platform takes $feePct%',
                  style: const TextStyle(color: Colors.white54, fontSize: 12)),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xFF00BFA5).withOpacity(0.15),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF00BFA5)),
          ),
          child: Text('$creatorPct%',
              style: const TextStyle(color: Color(0xFF00BFA5), fontWeight: FontWeight.bold, fontSize: 18)),
        ),
      ],
    );
  }
}

class _UploadBar extends StatelessWidget {
  final int used;
  final int cap;
  const _UploadBar({required this.used, required this.cap});

  @override
  Widget build(BuildContext context) {
    final pct = cap > 0 ? used / cap : 0.0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Weekly uploads', style: TextStyle(color: Colors.white54, fontSize: 12)),
            Text('$used / $cap', style: const TextStyle(color: Colors.white70, fontSize: 12)),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: pct.clamp(0.0, 1.0),
            backgroundColor: Colors.white12,
            valueColor: AlwaysStoppedAnimation(used >= cap ? Colors.redAccent : const Color(0xFFE040FB)),
            minHeight: 6,
          ),
        ),
      ],
    );
  }
}

class _StarRating extends StatelessWidget {
  final int halfStars; // 1–10
  const _StarRating({required this.halfStars});

  @override
  Widget build(BuildContext context) {
    final full = halfStars ~/ 2;
    final hasHalf = halfStars % 2 == 1;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) {
        if (i < full) return const Icon(Icons.star, color: Color(0xFFFFD700), size: 20);
        if (i == full && hasHalf) return const Icon(Icons.star_half, color: Color(0xFFFFD700), size: 20);
        return const Icon(Icons.star_border, color: Colors.white24, size: 20);
      }),
    );
  }
}

class _PrestigeCard extends StatelessWidget {
  final String title;
  final Color accent;
  final Widget child;
  const _PrestigeCard({required this.title, required this.accent, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accent.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(color: accent, fontWeight: FontWeight.bold, fontSize: 13)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  const _ActionButton({required this.label, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: const Color(0xFF1A1A2E),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white12),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: Colors.white70, size: 22),
            const SizedBox(height: 6),
            Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
