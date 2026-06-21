import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../../core/config/app_config.dart';

// ── Models ────────────────────────────────────────────────────────────────────

class CompanionProfile {
  final String id;
  final String userId;
  final String displayName;
  final String? bio;
  final String nationality;
  final List<String> languages;
  final String timezone;
  final int? heightCm;
  final List<String> hobbies;
  final List<String> interests;
  final List<String> sessionTypes;
  final List<String> activities;
  final String verificationStatus;
  final bool verificationBadge;
  final bool ageVerified;
  final String? introVideoUrl;
  final List<String> introImageUrls;
  final String status;
  final bool isAvailableNow;
  final double averageRating;
  final int reviewCount;

  const CompanionProfile({
    required this.id,
    required this.userId,
    required this.displayName,
    this.bio,
    required this.nationality,
    required this.languages,
    required this.timezone,
    this.heightCm,
    required this.hobbies,
    required this.interests,
    required this.sessionTypes,
    required this.activities,
    required this.verificationStatus,
    required this.verificationBadge,
    required this.ageVerified,
    this.introVideoUrl,
    required this.introImageUrls,
    required this.status,
    required this.isAvailableNow,
    required this.averageRating,
    required this.reviewCount,
  });

  factory CompanionProfile.fromJson(Map<String, dynamic> j) => CompanionProfile(
        id: j['id'] as String,
        userId: j['userId'] as String,
        displayName: j['displayName'] as String,
        bio: j['bio'] as String?,
        nationality: j['nationality'] as String,
        languages: List<String>.from(j['languages'] as List),
        timezone: j['timezone'] as String,
        heightCm: j['heightCm'] as int?,
        hobbies: List<String>.from(j['hobbies'] as List),
        interests: List<String>.from(j['interests'] as List),
        sessionTypes: List<String>.from(j['sessionTypes'] as List),
        activities: List<String>.from(j['activities'] as List),
        verificationStatus: j['verificationStatus'] as String,
        verificationBadge: j['verificationBadge'] as bool,
        ageVerified: j['ageVerified'] as bool,
        introVideoUrl: j['introVideoUrl'] as String?,
        introImageUrls: List<String>.from(j['introImageUrls'] as List),
        status: j['status'] as String,
        isAvailableNow: j['isAvailableNow'] as bool,
        averageRating: (j['averageRating'] as num).toDouble(),
        reviewCount: j['reviewCount'] as int,
      );
}

class CompanionRate {
  final String sessionType;
  final int durationMinutes;
  final int coinCost;
  final int maxParticipants;

  const CompanionRate({
    required this.sessionType,
    required this.durationMinutes,
    required this.coinCost,
    required this.maxParticipants,
  });

  factory CompanionRate.fromJson(Map<String, dynamic> j) => CompanionRate(
        sessionType: j['sessionType'] as String,
        durationMinutes: j['durationMinutes'] as int,
        coinCost: j['coinCost'] as int,
        maxParticipants: j['maxParticipants'] as int,
      );
}

// ── Providers ─────────────────────────────────────────────────────────────────

final companionDiscoveryProvider =
    FutureProvider.autoDispose.family<List<CompanionProfile>, String>((ref, userId) async {
  final res = await http.get(
    Uri.parse('${AppConfig.apiBase}/companion/discovery?userId=$userId'),
  );
  if (res.statusCode == 403) throw Exception('Age verification required');
  if (res.statusCode != 200) throw Exception('Failed to load companions');
  return (jsonDecode(res.body) as List)
      .map((c) => CompanionProfile.fromJson(c as Map<String, dynamic>))
      .toList();
});

final companionProfileProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, companionId) async {
  final res = await http.get(
    Uri.parse('${AppConfig.apiBase}/companions/$companionId'),
  );
  if (res.statusCode != 200) throw Exception('Failed to load companion profile');
  return jsonDecode(res.body) as Map<String, dynamic>;
});

final companionRecommendationsProvider =
    FutureProvider.autoDispose.family<List<CompanionProfile>, String>((ref, userId) async {
  final res = await http.get(
    Uri.parse('${AppConfig.apiBase}/companion/recommendations?userId=$userId'),
  );
  if (res.statusCode != 200) return [];
  final data = jsonDecode(res.body) as Map<String, dynamic>;
  return (data['companions'] as List)
      .map((c) => CompanionProfile.fromJson(c as Map<String, dynamic>))
      .toList();
});
