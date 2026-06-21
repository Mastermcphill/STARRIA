import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../../core/config/app_config.dart';

// ── Models ────────────────────────────────────────────────────────────────────

class PatronProfile {
  final String id;
  final String userId;
  final String displayName;
  final String? avatarUrl;
  final String tier;
  final int lifetimeUsdCents;
  final int lifetimeCoins;
  final int supportDiversity;
  final bool isPublic;

  const PatronProfile({
    required this.id,
    required this.userId,
    required this.displayName,
    this.avatarUrl,
    required this.tier,
    required this.lifetimeUsdCents,
    required this.lifetimeCoins,
    required this.supportDiversity,
    required this.isPublic,
  });

  factory PatronProfile.fromJson(Map<String, dynamic> j) => PatronProfile(
        id: j['id'] as String,
        userId: j['userId'] as String,
        displayName: j['displayName'] as String,
        avatarUrl: j['avatarUrl'] as String?,
        tier: j['tier'] as String,
        lifetimeUsdCents: j['lifetimeUsdCents'] as int,
        lifetimeCoins: j['lifetimeCoins'] as int,
        supportDiversity: j['supportDiversity'] as int,
        isPublic: j['isPublic'] as bool,
      );
}

class CreatorRelationship {
  final String starId;
  final int creatorLifetimeUsdCents;
  final String creatorTier;
  final String lastSupportedAt;

  const CreatorRelationship({
    required this.starId,
    required this.creatorLifetimeUsdCents,
    required this.creatorTier,
    required this.lastSupportedAt,
  });

  factory CreatorRelationship.fromJson(Map<String, dynamic> j) =>
      CreatorRelationship(
        starId: j['starId'] as String,
        creatorLifetimeUsdCents: j['creatorLifetimeUsdCents'] as int,
        creatorTier: j['creatorTier'] as String,
        lastSupportedAt: j['lastSupportedAt'] as String,
      );
}

class PatronAchievement {
  final String id;
  final String achievementType;
  final String title;
  final String description;
  final String badge;
  final String unlockedAt;

  const PatronAchievement({
    required this.id,
    required this.achievementType,
    required this.title,
    required this.description,
    required this.badge,
    required this.unlockedAt,
  });

  factory PatronAchievement.fromJson(Map<String, dynamic> j) => PatronAchievement(
        id: j['id'] as String,
        achievementType: j['achievementType'] as String,
        title: j['title'] as String,
        description: j['description'] as String,
        badge: j['badge'] as String,
        unlockedAt: j['unlockedAt'] as String,
      );
}

// ── Providers ─────────────────────────────────────────────────────────────────

class PatronDashboardData {
  final PatronProfile profile;
  final List<CreatorRelationship> relationships;
  final List<PatronAchievement> achievements;

  const PatronDashboardData({
    required this.profile,
    required this.relationships,
    required this.achievements,
  });
}

final patronDashboardProvider =
    FutureProvider.autoDispose.family<PatronDashboardData, String>((ref, userId) async {
  final res = await http.get(
    Uri.parse('${AppConfig.apiBase}/patrons/me?userId=$userId'),
  );
  if (res.statusCode != 200) throw Exception('Failed to load patron profile');
  final data = jsonDecode(res.body) as Map<String, dynamic>;
  return PatronDashboardData(
    profile: PatronProfile.fromJson(data['profile'] as Map<String, dynamic>),
    relationships: (data['relationships'] as List)
        .map((r) => CreatorRelationship.fromJson(r as Map<String, dynamic>))
        .toList(),
    achievements: (data['achievements'] as List)
        .map((a) => PatronAchievement.fromJson(a as Map<String, dynamic>))
        .toList(),
  );
});
