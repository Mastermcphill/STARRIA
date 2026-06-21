import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'companion_provider.dart';

/// CompanionDiscoveryScreen — age-gated, completely separate from /discovery.
/// Entered only after AgeGateScreen passes.
class CompanionDiscoveryScreen extends ConsumerWidget {
  final String userId;
  const CompanionDiscoveryScreen({super.key, required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(companionDiscoveryProvider(userId));
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text('STARRIA Companion', style: TextStyle(color: Colors.white)),
        actions: [
          IconButton(
            icon: const Icon(Icons.tune, color: Colors.white),
            tooltip: 'Filters',
            onPressed: () {},
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFFE040FB))),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock, color: Colors.grey, size: 64),
              const SizedBox(height: 16),
              Text('$e', style: const TextStyle(color: Colors.grey)),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => context.go('/companion/gate/$userId'),
                child: const Text('Verify Age'),
              ),
            ],
          ),
        ),
        data: (companions) {
          if (companions.isEmpty) {
            return const Center(
              child: Text('No companions available right now.',
                  style: TextStyle(color: Colors.grey)),
            );
          }
          return GridView.builder(
            padding: const EdgeInsets.all(12),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 0.65,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
            ),
            itemCount: companions.length,
            itemBuilder: (context, i) => _CompanionCard(
              companion: companions[i],
              onTap: () => context.push('/companion/${companions[i].id}'),
            ),
          );
        },
      ),
    );
  }
}

class _CompanionCard extends StatelessWidget {
  final CompanionProfile companion;
  final VoidCallback onTap;
  const _CompanionCard({required this.companion, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: const Color(0xFF1A1A1A),
        ),
        clipBehavior: Clip.hardEdge,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Photo ────────────────────────────────────────────────────────
            Expanded(
              flex: 3,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  companion.introImageUrls.isNotEmpty
                      ? Image.network(companion.introImageUrls.first, fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => _PlaceholderPhoto(name: companion.displayName))
                      : _PlaceholderPhoto(name: companion.displayName),

                  // Available now badge
                  if (companion.isAvailableNow)
                    Positioned(
                      top: 8, left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.green,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text('LIVE', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                      ),
                    ),

                  // Verified badge
                  if (companion.verificationBadge)
                    const Positioned(
                      top: 8, right: 8,
                      child: Icon(Icons.verified, color: Colors.blue, size: 18),
                    ),
                ],
              ),
            ),

            // ── Info ─────────────────────────────────────────────────────────
            Expanded(
              flex: 2,
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(companion.displayName,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text('🌍 ${companion.nationality}',
                        style: const TextStyle(color: Colors.grey, fontSize: 11)),
                    Text('🗣 ${companion.languages.take(2).join(', ')}',
                        style: const TextStyle(color: Colors.grey, fontSize: 11)),
                    if (companion.heightCm != null)
                      Text('📏 ${companion.heightCm}cm',
                          style: const TextStyle(color: Colors.grey, fontSize: 11)),
                    const Spacer(),
                    Row(
                      children: [
                        const Icon(Icons.star, color: Colors.amber, size: 12),
                        Text(' ${companion.averageRating.toStringAsFixed(1)}',
                            style: const TextStyle(color: Colors.white, fontSize: 11)),
                        const SizedBox(width: 4),
                        Text('(${companion.reviewCount})',
                            style: const TextStyle(color: Colors.grey, fontSize: 11)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlaceholderPhoto extends StatelessWidget {
  final String name;
  const _PlaceholderPhoto({required this.name});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF2A2A2A),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: const TextStyle(fontSize: 48, color: Color(0xFFE040FB)),
        ),
      ),
    );
  }
}
