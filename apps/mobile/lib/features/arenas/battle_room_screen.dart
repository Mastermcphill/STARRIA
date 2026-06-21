import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import '../../../core/config/api_config.dart';
import 'battle_models.dart';
import 'arenas_provider.dart';

class BattleRoomScreen extends ConsumerStatefulWidget {
  final String battleId;
  const BattleRoomScreen({super.key, required this.battleId});

  @override
  ConsumerState<BattleRoomScreen> createState() => _BattleRoomScreenState();
}

class _BattleRoomScreenState extends ConsumerState<BattleRoomScreen> {
  Battle? _battle;
  bool _loading = true;
  bool _voted = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await http.get(Uri.parse('${ApiConfig.baseUrl}/arenas/${widget.battleId}'));
      if (res.statusCode == 200 && mounted) {
        setState(() {
          _battle = Battle.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _vote(String participantId) async {
    // voterId is derived from the auth token server-side (no client-supplied id).
    final ok = await ref.read(battlesProvider.notifier).castVote(widget.battleId, participantId);
    if (ok && mounted) {
      setState(() => _voted = true);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Vote cast!'), backgroundColor: Colors.green));
      await _load();
    }
  }

  Color _statusColor(BattleStatus s) {
    switch (s) {
      case BattleStatus.ACTIVE: return Colors.green;
      case BattleStatus.VOTING: return Colors.amber;
      case BattleStatus.SETTLED: return Colors.blue;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(backgroundColor: Colors.black, body: Center(child: CircularProgressIndicator(color: Colors.amber)));

    final b = _battle;
    if (b == null) return Scaffold(backgroundColor: Colors.black, appBar: AppBar(backgroundColor: Colors.black, iconTheme: const IconThemeData(color: Colors.white)), body: const Center(child: Text('Battle not found', style: TextStyle(color: Colors.white38))));

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(b.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: _statusColor(b.status).withOpacity(0.2), borderRadius: BorderRadius.circular(20), border: Border.all(color: _statusColor(b.status))),
            child: Text(b.status.name, style: TextStyle(color: _statusColor(b.status), fontWeight: FontWeight.bold, fontSize: 12)),
          ),
        ],
      ),
      body: Column(
        children: [
          // Battle type banner
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 8),
            color: Colors.amber.withOpacity(0.1),
            child: Text(b.type.name.replaceAll('_', ' '), textAlign: TextAlign.center, style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold, letterSpacing: 2)),
          ),

          // VS display
          Expanded(
            child: b.participants.isEmpty
                ? const Center(child: Text('No participants yet', style: TextStyle(color: Colors.white38)))
                : _VSView(participants: b.participants, status: b.status, voted: _voted, onVote: _vote, winnerStarId: b.winnerStarId),
          ),

          // Prize pool
          if (b.prizePool != null) _PrizePoolBar(pool: b.prizePool!),

          // Actions
          if (b.status == BattleStatus.VOTING && !_voted)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text('Tap a participant to vote!', style: TextStyle(color: Colors.amber.shade200, fontSize: 14), textAlign: TextAlign.center),
            ),

          if (b.status == BattleStatus.SETTLED && b.winnerStarId != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              color: Colors.amber.withOpacity(0.1),
              child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.emoji_events, color: Colors.amber),
                SizedBox(width: 8),
                Text('Battle Settled! Winner crowned.', style: TextStyle(color: Colors.amber, fontWeight: FontWeight.bold)),
              ]),
            ),

          SafeArea(child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              Expanded(child: OutlinedButton(onPressed: () => context.push('/arenas/battle/${b.id}/prize-pool'), style: OutlinedButton.styleFrom(foregroundColor: Colors.amber, side: const BorderSide(color: Colors.amber)), child: const Text('Prize Pool'))),
              const SizedBox(width: 8),
              Expanded(child: OutlinedButton(onPressed: () => context.push('/arenas/battle/${b.id}/history'), style: OutlinedButton.styleFrom(foregroundColor: Colors.white54, side: const BorderSide(color: Colors.white24)), child: const Text('History'))),
            ]),
          )),
        ],
      ),
    );
  }
}

class _VSView extends StatelessWidget {
  final List<BattleParticipant> participants;
  final BattleStatus status;
  final bool voted;
  final void Function(String) onVote;
  final String? winnerStarId;

  const _VSView({required this.participants, required this.status, required this.voted, required this.onVote, this.winnerStarId});

  @override
  Widget build(BuildContext context) {
    final p1 = participants.isNotEmpty ? participants[0] : null;
    final p2 = participants.length > 1 ? participants[1] : null;

    return Row(
      children: [
        if (p1 != null) Expanded(child: _ParticipantCard(p: p1, status: status, voted: voted, onVote: onVote, isWinner: winnerStarId == p1.starProfileId)),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: const Text('VS', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 24)),
        ),
        if (p2 != null) Expanded(child: _ParticipantCard(p: p2, status: status, voted: voted, onVote: onVote, isWinner: winnerStarId == p2.starProfileId)),
      ],
    );
  }
}

class _ParticipantCard extends StatelessWidget {
  final BattleParticipant p;
  final BattleStatus status;
  final bool voted;
  final void Function(String) onVote;
  final bool isWinner;

  const _ParticipantCard({required this.p, required this.status, required this.voted, required this.onVote, required this.isWinner});

  @override
  Widget build(BuildContext context) {
    final canVote = status == BattleStatus.VOTING && !voted;
    return GestureDetector(
      onTap: canVote ? () => onVote(p.id) : null,
      child: Container(
        margin: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isWinner ? Colors.amber.withOpacity(0.1) : Colors.grey[900],
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isWinner ? Colors.amber : (canVote ? Colors.white24 : Colors.transparent), width: isWinner ? 2 : 1),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (isWinner) const Icon(Icons.emoji_events, color: Colors.amber, size: 28),
            const CircleAvatar(radius: 36, backgroundColor: Colors.grey, child: Icon(Icons.person, color: Colors.white, size: 36)),
            const SizedBox(height: 8),
            Text(p.starProfileId.substring(0, 8), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold), maxLines: 1, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 4),
            Text('${p.voteCount} votes', style: const TextStyle(color: Colors.amber, fontSize: 12)),
            if (canVote) ...[
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => onVote(p.id),
                style: ElevatedButton.styleFrom(backgroundColor: Colors.amber, foregroundColor: Colors.black, padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8)),
                child: const Text('VOTE', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PrizePoolBar extends StatelessWidget {
  final PrizePool pool;
  const _PrizePoolBar({required this.pool});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: Colors.amber.withOpacity(0.05),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.emoji_events, color: Colors.amber, size: 20),
          const SizedBox(width: 8),
          Text('Prize Pool: ${pool.totalCoins} coins  •  ${pool.distribution.replaceAll('_', ' ')}',
              style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold, fontSize: 13)),
          if (pool.settled) ...[
            const SizedBox(width: 8),
            Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: Colors.green.withOpacity(0.2), borderRadius: BorderRadius.circular(4)), child: const Text('SETTLED', style: TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.bold))),
          ],
        ],
      ),
    );
  }
}
