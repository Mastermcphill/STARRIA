// Battle domain models for Sprint 8

enum BattleType { RAP_BATTLE, SING_OFF, COMEDY_CLASH, YAP_BATTLE, AI_FILM_BATTLE, CREATOR_DUEL, TEAM_BATTLE }
enum BattleStatus { DRAFT, REGISTRATION, ACTIVE, VOTING, SETTLED, ARCHIVED }
enum VotingMethod { AUDIENCE, SUPPORTER_WEIGHTED, JUDGE, HYBRID }
enum ArenaDivision { BRONZE, SILVER, GOLD, PLATINUM, DIAMOND, LEGEND }

class Battle {
  final String id;
  final String title;
  final BattleType type;
  final BattleStatus status;
  final VotingMethod votingMethod;
  final bool isTeamBattle;
  final String? winnerStarId;
  final DateTime? startedAt;
  final DateTime? endedAt;
  final List<BattleParticipant> participants;
  final PrizePool? prizePool;

  const Battle({
    required this.id,
    required this.title,
    required this.type,
    required this.status,
    required this.votingMethod,
    required this.isTeamBattle,
    this.winnerStarId,
    this.startedAt,
    this.endedAt,
    this.participants = const [],
    this.prizePool,
  });

  factory Battle.fromJson(Map<String, dynamic> j) => Battle(
    id: j['id'] as String,
    title: j['title'] as String,
    type: BattleType.values.firstWhere((e) => e.name == j['type'], orElse: () => BattleType.CREATOR_DUEL),
    status: BattleStatus.values.firstWhere((e) => e.name == j['status'], orElse: () => BattleStatus.DRAFT),
    votingMethod: VotingMethod.values.firstWhere((e) => e.name == (j['votingMethod'] ?? 'HYBRID'), orElse: () => VotingMethod.HYBRID),
    isTeamBattle: j['isTeamBattle'] as bool? ?? false,
    winnerStarId: j['winnerStarId'] as String?,
    participants: (j['participants'] as List<dynamic>? ?? []).map((p) => BattleParticipant.fromJson(p as Map<String, dynamic>)).toList(),
    prizePool: j['prizePool'] != null ? PrizePool.fromJson(j['prizePool'] as Map<String, dynamic>) : null,
  );
}

class BattleParticipant {
  final String id;
  final String starProfileId;
  final String role;
  final int voteCount;
  final int score;

  const BattleParticipant({
    required this.id,
    required this.starProfileId,
    required this.role,
    required this.voteCount,
    required this.score,
  });

  factory BattleParticipant.fromJson(Map<String, dynamic> j) => BattleParticipant(
    id: j['id'] as String,
    starProfileId: j['starProfileId'] as String,
    role: j['role'] as String? ?? 'CHALLENGER',
    voteCount: j['voteCount'] as int? ?? 0,
    score: j['score'] as int? ?? 0,
  );
}

class PrizePool {
  final String id;
  final int totalCoins;
  final String distribution;
  final bool settled;

  const PrizePool({
    required this.id,
    required this.totalCoins,
    required this.distribution,
    required this.settled,
  });

  factory PrizePool.fromJson(Map<String, dynamic> j) => PrizePool(
    id: j['id'] as String,
    totalCoins: j['totalCoins'] as int? ?? 0,
    distribution: j['distribution'] as String? ?? 'WINNER_TAKES_ALL',
    settled: j['settled'] as bool? ?? false,
  );
}

class CreatorEloEntry {
  final String starProfileId;
  final int elo;
  final ArenaDivision division;
  final int wins;
  final int losses;
  final int rank;

  const CreatorEloEntry({
    required this.starProfileId,
    required this.elo,
    required this.division,
    required this.wins,
    required this.losses,
    required this.rank,
  });

  factory CreatorEloEntry.fromJson(Map<String, dynamic> j, int rank) => CreatorEloEntry(
    starProfileId: j['starProfileId'] as String,
    elo: j['elo'] as int? ?? 1200,
    division: ArenaDivision.values.firstWhere((e) => e.name == j['division'], orElse: () => ArenaDivision.BRONZE),
    wins: j['wins'] as int? ?? 0,
    losses: j['losses'] as int? ?? 0,
    rank: rank,
  );
}

class CreatorHouse {
  final String id;
  final String name;
  final String slug;
  final String? description;
  final String? avatarUrl;
  final int memberCount;

  const CreatorHouse({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    this.avatarUrl,
    required this.memberCount,
  });

  factory CreatorHouse.fromJson(Map<String, dynamic> j) => CreatorHouse(
    id: j['id'] as String,
    name: j['name'] as String,
    slug: j['slug'] as String,
    description: j['description'] as String?,
    avatarUrl: j['avatarUrl'] as String?,
    memberCount: j['memberCount'] as int? ?? 0,
  );
}
