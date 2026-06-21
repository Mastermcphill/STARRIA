import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../../../core/config/api_config.dart';
import 'battle_models.dart';
import 'arenas_provider.dart';

class VotingScreen extends ConsumerStatefulWidget {
  final String battleId;
  const VotingScreen({super.key, required this.battleId});

  @override
  ConsumerState<VotingScreen> createState() => _VotingScreenState();
}

class _VotingScreenState extends ConsumerState<VotingScreen> {
  Battle? _battle;
  bool _loading = true;
  bool _voted = false;
  String? _selectedId;
  bool _submitting = false;

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

  Future<void> _submit() async {
    if (_selectedId == null) return;
    setState(() => _submitting = true);
    // voterId is derived from the auth token server-side (no client-supplied id).
    final ok = await ref.read(battlesProvider.notifier).castVote(widget.battleId, _selectedId!);
    if (mounted) {
      setState(() { _submitting = false; _voted = ok; });
      if (ok) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Vote submitted!'), backgroundColor: Colors.green));
        await _load();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(backgroundColor: Colors.black, body: Center(child: CircularProgressIndicator(color: Colors.amber)));

    final b = _battle;
    if (b == null || b.status != BattleStatus.VOTING) {
      return Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(backgroundColor: Colors.black, iconTheme: const IconThemeData(color: Colors.white), title: const Text('Vote', style: TextStyle(color: Colors.white))),
        body: const Center(child: Text('Voting is not open for this battle', style: TextStyle(color: Colors.white38))),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text('Vote — ${b.title}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                const Icon(Icons.how_to_vote, color: Colors.amber, size: 40),
                const SizedBox(height: 8),
                const Text('Choose your winner', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text('${b.votingMethod.name.replaceAll("_", " ")} voting', style: const TextStyle(color: Colors.white38, fontSize: 13)),
              ],
            ),
          ),
          Expanded(
            child: _voted
                ? const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.check_circle, color: Colors.green, size: 64),
                    SizedBox(height: 16),
                    Text('Your vote has been cast!', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  ]))
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: b.participants.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (ctx, i) {
                      final p = b.participants[i];
                      final selected = _selectedId == p.id;
                      return GestureDetector(
                        onTap: () => setState(() => _selectedId = p.id),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: selected ? Colors.amber.withOpacity(0.15) : Colors.grey[900],
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: selected ? Colors.amber : Colors.white12, width: selected ? 2 : 1),
                          ),
                          child: Row(
                            children: [
                              const CircleAvatar(radius: 24, backgroundColor: Colors.grey, child: Icon(Icons.person, color: Colors.white)),
                              const SizedBox(width: 16),
                              Expanded(child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(p.starProfileId.substring(0, 12), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                                  Text('${p.voteCount} votes so far', style: const TextStyle(color: Colors.white38, fontSize: 12)),
                                ],
                              )),
                              if (selected) const Icon(Icons.check_circle, color: Colors.amber),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
          if (!_voted)
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: _selectedId == null || _submitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.amber,
                    disabledBackgroundColor: Colors.grey[800],
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _submitting
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2))
                      : const Text('CAST VOTE', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 16, letterSpacing: 1.5)),
                ),
              ),
            ),
          const SafeArea(child: SizedBox.shrink()),
        ],
      ),
    );
  }
}
