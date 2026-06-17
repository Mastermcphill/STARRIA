// Discovery feature — data models

class GenreInfo {
  final String genre;
  final String label;
  const GenreInfo({required this.genre, required this.label});

  factory GenreInfo.fromJson(Map<String, dynamic> json) =>
      GenreInfo(genre: json['genre'] as String, label: json['label'] as String);
}

class DiscoveryItem {
  final String videoId;
  final String starProfileId;
  final String title;
  final String genre;
  final String? country;
  final String? language;
  final String? thumbnailUrl;
  final String? playbackUrl;
  final double score;
  final int tapCount;
  final int viewCount;

  const DiscoveryItem({
    required this.videoId,
    required this.starProfileId,
    required this.title,
    required this.genre,
    required this.score,
    required this.tapCount,
    required this.viewCount,
    this.country,
    this.language,
    this.thumbnailUrl,
    this.playbackUrl,
  });

  factory DiscoveryItem.fromJson(Map<String, dynamic> json) => DiscoveryItem(
        videoId: json['videoId'] as String,
        starProfileId: json['starProfileId'] as String,
        title: json['title'] as String? ?? '',
        genre: json['genre'] as String? ?? 'COMEDY',
        country: json['country'] as String?,
        language: json['language'] as String?,
        thumbnailUrl: json['thumbnailUrl'] as String?,
        playbackUrl: json['playbackUrl'] as String?,
        score: (json['score'] as num?)?.toDouble() ?? 0,
        tapCount: (json['tapCount'] as num?)?.toInt() ?? 0,
        viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
      );
}

class TrendingItem extends DiscoveryItem {
  final int rank;
  final String scope;
  const TrendingItem({
    required this.rank,
    required this.scope,
    required super.videoId,
    required super.starProfileId,
    required super.title,
    required super.genre,
    required super.score,
    required super.tapCount,
    required super.viewCount,
    super.country,
    super.language,
    super.thumbnailUrl,
    super.playbackUrl,
  });

  factory TrendingItem.fromJson(Map<String, dynamic> json) => TrendingItem(
        rank: (json['rank'] as num?)?.toInt() ?? 0,
        scope: json['scope'] as String? ?? 'GLOBAL',
        videoId: json['videoId'] as String,
        starProfileId: json['starProfileId'] as String,
        title: json['title'] as String? ?? '',
        genre: json['genre'] as String? ?? 'COMEDY',
        country: json['country'] as String?,
        language: json['language'] as String?,
        thumbnailUrl: json['thumbnailUrl'] as String?,
        playbackUrl: json['playbackUrl'] as String?,
        score: (json['score'] as num?)?.toDouble() ?? 0,
        tapCount: (json['tapCount'] as num?)?.toInt() ?? 0,
        viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
      );
}
