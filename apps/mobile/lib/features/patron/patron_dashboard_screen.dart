import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'patron_provider.dart';

class PatronDashboardScreen extends ConsumerWidget {
  final String userId;
  const PatronDashboardScreen({super.key, required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(patronDashboardProvider(userId));
    return Scaffold(
      appBar: AppBar(title: const Text('Patron Dashboard')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (data) => _Body(data: data),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  final PatronDashboardData data;
  const _Body({required this.data});

  @override
  Widget build(BuildContext context) {
    final profile = data.profile;
    final theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Tier card ──────────────────────────────────────────────────────────
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                _TierBadge(tier: profile.tier),
                const SizedBox(height: 12),
                Text(
                  profile.displayName,
                  style: theme.textTheme.headlineSmall,
                ),
                const SizedBox(height: 4),
                Text(
                  '\$${(profile.lifetimeUsdCents / 100).toStringAsFixed(2)} lifetime',
                  style: theme.textTheme.bodyLarge
                      ?.copyWith(color: theme.colorScheme.secondary),
                ),
                const SizedBox(height: 4),
                Text(
                  '${profile.supportDiversity} creators supported',
                  style: theme.textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 16),

        // ── Achievements ──────────────────────────────────────────────────────
        if (data.achievements.isNotEmpty) ...[
          Text('Achievements', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          SizedBox(
            height: 80,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: data.achievements.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final a = data.achievements[i];
                return Tooltip(
                  message: a.description,
                  child: Chip(
                    avatar: Text(a.badge, style: const TextStyle(fontSize: 18)),
                    label: Text(a.title, style: const TextStyle(fontSize: 11)),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 16),
        ],

        // ── Creator Relationships ─────────────────────────────────────────────
        Text('Your Creators', style: theme.textTheme.titleMedium),
        const SizedBox(height: 8),
        ...data.relationships.map((rel) => ListTile(
              leading: _TierBadge(tier: rel.creatorTier, small: true),
              title: Text(rel.starId),
              subtitle: Text(
                '\$${(rel.creatorLifetimeUsdCents / 100).toStringAsFixed(2)} spent',
              ),
              trailing: Text(rel.creatorTier,
                  style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
      ],
    );
  }
}

class _TierBadge extends StatelessWidget {
  final String tier;
  final bool small;
  const _TierBadge({required this.tier, this.small = false});

  @override
  Widget build(BuildContext context) {
    final (emoji, color) = switch (tier) {
      'OG'         => ('👑', const Color(0xFFFF6F00)),
      'LEGEND'     => ('💎', const Color(0xFFFFD700)),
      'BENEFACTOR' => ('⭐', const Color(0xFF26C6DA)),
      'PATRON'     => ('💜', const Color(0xFFAB47BC)),
      'SUPPORTER'  => ('⭐', const Color(0xFF64B5F6)),
      _            => ('', const Color(0xFF9E9E9E)),
    };

    final size = small ? 24.0 : 48.0;
    final fontSize = small ? 16.0 : 32.0;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        shape: BoxShape.circle,
        border: Border.all(color: color, width: 2),
      ),
      child: Center(
        child: Text(emoji, style: TextStyle(fontSize: fontSize * 0.6)),
      ),
    );
  }
}
