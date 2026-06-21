import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'companion_provider.dart';

class CompanionProfileScreen extends ConsumerWidget {
  final String companionId;
  final String userId;

  const CompanionProfileScreen({
    super.key,
    required this.companionId,
    required this.userId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(companionProfileProvider(companionId));
    return Scaffold(
      backgroundColor: Colors.black,
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFFE040FB))),
        error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: Colors.grey))),
        data: (data) {
          final p = CompanionProfile.fromJson(data['profile'] as Map<String, dynamic>);
          final rates = (data['rates'] as List? ?? [])
              .map((r) => CompanionRate.fromJson(r as Map<String, dynamic>))
              .toList();
          return _Body(companion: p, rates: rates, userId: userId);
        },
      ),
    );
  }
}

class _Body extends StatelessWidget {
  final CompanionProfile companion;
  final List<CompanionRate> rates;
  final String userId;

  const _Body({required this.companion, required this.rates, required this.userId});

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        // ── Hero image ────────────────────────────────────────────────────────
        SliverAppBar(
          expandedHeight: 320,
          pinned: true,
          backgroundColor: Colors.black,
          flexibleSpace: FlexibleSpaceBar(
            background: companion.introImageUrls.isNotEmpty
                ? Image.network(companion.introImageUrls.first, fit: BoxFit.cover)
                : Container(color: const Color(0xFF2A2A2A),
                    child: Center(child: Text(companion.displayName[0].toUpperCase(),
                        style: const TextStyle(fontSize: 80, color: Color(0xFFE040FB))))),
          ),
        ),

        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Name + badge ──────────────────────────────────────────────
                Row(
                  children: [
                    Expanded(
                      child: Text(companion.displayName,
                          style: const TextStyle(color: Colors.white, fontSize: 24,
                              fontWeight: FontWeight.bold)),
                    ),
                    if (companion.verificationBadge)
                      const Icon(Icons.verified, color: Colors.blue, size: 24),
                    if (companion.isAvailableNow) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.green,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text('Available Now',
                            style: TextStyle(color: Colors.white, fontSize: 12)),
                      ),
                    ],
                  ],
                ),

                const SizedBox(height: 8),
                // ── Stats row ─────────────────────────────────────────────────
                Row(
                  children: [
                    const Icon(Icons.star, color: Colors.amber, size: 16),
                    Text(' ${companion.averageRating.toStringAsFixed(1)}  ·  '
                        '${companion.reviewCount} reviews',
                        style: const TextStyle(color: Colors.grey)),
                    const SizedBox(width: 12),
                    Text('🌍 ${companion.nationality}',
                        style: const TextStyle(color: Colors.grey)),
                  ],
                ),

                const SizedBox(height: 16),

                // ── Details chips ─────────────────────────────────────────────
                _Section(
                  title: 'About',
                  child: Text(companion.bio ?? 'No bio provided.',
                      style: const TextStyle(color: Colors.grey)),
                ),

                _ChipRow('Languages', companion.languages),
                if (companion.hobbies.isNotEmpty) _ChipRow('Hobbies', companion.hobbies),
                if (companion.interests.isNotEmpty) _ChipRow('Interests', companion.interests),
                _ChipRow('Session Types', companion.sessionTypes),
                _ChipRow('Activities', companion.activities),

                const SizedBox(height: 20),

                // ── Rates ─────────────────────────────────────────────────────
                if (rates.isNotEmpty) ...[
                  const Text('Session Rates',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 12),
                  ...rates.map((r) => _RateRow(rate: r)),
                ],

                const SizedBox(height: 32),

                // ── Book CTA ──────────────────────────────────────────────────
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => context.push('/companion/${companion.id}/book',
                        extra: {'userId': userId}),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFE040FB),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    icon: const Icon(Icons.calendar_month),
                    label: const Text('Book a Session', style: TextStyle(fontSize: 16)),
                  ),
                ),

                const SizedBox(height: 12),

                // ── Safety actions ────────────────────────────────────────────
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {},
                        icon: const Icon(Icons.block, size: 16),
                        label: const Text('Block'),
                        style: OutlinedButton.styleFrom(foregroundColor: Colors.grey),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {},
                        icon: const Icon(Icons.flag, size: 16),
                        label: const Text('Report'),
                        style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final Widget child;
  const _Section({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        child,
        const SizedBox(height: 20),
      ],
    );
  }
}

class _ChipRow extends StatelessWidget {
  final String label;
  final List<String> items;
  const _ChipRow(this.label, this.items);

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(color: Colors.white70, fontSize: 13,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8, runSpacing: 6,
            children: items.map((item) => Chip(
              label: Text(item, style: const TextStyle(fontSize: 12)),
              backgroundColor: const Color(0xFF2A2A2A),
              labelStyle: const TextStyle(color: Colors.white70),
              padding: EdgeInsets.zero,
            )).toList(),
          ),
        ],
      ),
    );
  }
}

class _RateRow extends StatelessWidget {
  final CompanionRate rate;
  const _RateRow({required this.rate});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text('${rate.sessionType} · ${rate.durationMinutes} min',
                style: const TextStyle(color: Colors.white)),
          ),
          Text('${rate.coinCost} coins',
              style: const TextStyle(color: Color(0xFFE040FB), fontWeight: FontWeight.bold)),
          if (rate.maxParticipants > 1)
            Text('  (${rate.maxParticipants} max)',
                style: const TextStyle(color: Colors.grey, fontSize: 12)),
        ],
      ),
    );
  }
}
