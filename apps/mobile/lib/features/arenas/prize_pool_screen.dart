import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../../core/config/api_config.dart';

class PrizePoolScreen extends StatefulWidget {
  final String battleId;
  const PrizePoolScreen({super.key, required this.battleId});

  @override
  State<PrizePoolScreen> createState() => _PrizePoolScreenState();
}

class _PrizePoolScreenState extends State<PrizePoolScreen> {
  Map<String, dynamic>? _battle;
  bool _loading = true;
  final _coinsCtrl = TextEditingController();
  String _source = 'FAN_CONTRIBUTION';
  bool _contributing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _coinsCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await http.get(Uri.parse('${ApiConfig.baseUrl}/arenas/${widget.battleId}'));
      if (res.statusCode == 200 && mounted) {
        setState(() { _battle = jsonDecode(res.body) as Map<String, dynamic>; _loading = false; });
      }
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _contribute() async {
    final coins = int.tryParse(_coinsCtrl.text.trim());
    if (coins == null || coins <= 0) return;
    setState(() => _contributing = true);
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/arenas/${widget.battleId}/prize-pool/contribute'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'contributorId': 'current-user', 'source': _source, 'coins': coins}),
      );
      if (res.statusCode == 200 && mounted) {
        _coinsCtrl.clear();
        await _load();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Contributed!'), backgroundColor: Colors.green));
      }
    } finally {
      if (mounted) setState(() => _contributing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pool = (_battle?['prizePool'] as Map<String, dynamic>?);

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text('Prize Pool', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Colors.amber))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Pool summary card
                  if (pool != null)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [Color(0xFF2D2000), Color(0xFF1A1100)]),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.amber.withOpacity(0.4)),
                      ),
                      child: Column(
                        children: [
                          const Icon(Icons.emoji_events, color: Colors.amber, size: 48),
                          const SizedBox(height: 8),
                          Text('${pool['totalCoins']} coins', style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold, fontSize: 32)),
                          const SizedBox(height: 4),
                          Text((pool['distribution'] as String).replaceAll('_', ' '), style: const TextStyle(color: Colors.white54, fontSize: 14)),
                          if (pool['settled'] == true) ...[
                            const SizedBox(height: 8),
                            Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), decoration: BoxDecoration(color: Colors.green.withOpacity(0.2), borderRadius: BorderRadius.circular(20)), child: const Text('SETTLED', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold))),
                          ],
                        ],
                      ),
                    )
                  else
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(color: Colors.grey[900], borderRadius: BorderRadius.circular(16)),
                      child: const Center(child: Text('No prize pool configured', style: TextStyle(color: Colors.white38))),
                    ),

                  const SizedBox(height: 24),

                  // Payout structure
                  const Text('Payout Structure', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 12),
                  for (final entry in [
                    {'label': '🥇 1st Place', 'pct': pool?['distribution'] == 'WINNER_TAKES_ALL' ? '100%' : '50%'},
                    {'label': '🥈 2nd Place', 'pct': pool?['distribution'] == 'TOP_3_PAYOUT' ? '30%' : '—'},
                    {'label': '🥉 3rd Place', 'pct': pool?['distribution'] == 'TOP_3_PAYOUT' ? '20%' : '—'},
                  ]) _PayoutRow(label: entry['label']!, pct: entry['pct']!),

                  const SizedBox(height: 24),

                  // Contribute section
                  if (pool != null && pool['settled'] != true) ...[
                    const Text('Contribute to Prize Pool', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 12),

                    DropdownButtonFormField<String>(
                      value: _source,
                      dropdownColor: Colors.grey[900],
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'Source',
                        labelStyle: const TextStyle(color: Colors.white54),
                        enabledBorder: OutlineInputBorder(borderSide: const BorderSide(color: Colors.white24), borderRadius: BorderRadius.circular(8)),
                        focusedBorder: OutlineInputBorder(borderSide: const BorderSide(color: Colors.amber), borderRadius: BorderRadius.circular(8)),
                        filled: true,
                        fillColor: Colors.grey[900],
                      ),
                      items: const [
                        DropdownMenuItem(value: 'FAN_CONTRIBUTION', child: Text('Fan Contribution')),
                        DropdownMenuItem(value: 'CREATOR_DEPOSIT', child: Text('Creator Deposit')),
                        DropdownMenuItem(value: 'SPONSORSHIP', child: Text('Sponsorship')),
                        DropdownMenuItem(value: 'TICKETS', child: Text('Tickets')),
                      ],
                      onChanged: (v) => setState(() => _source = v ?? _source),
                    ),
                    const SizedBox(height: 12),

                    TextField(
                      controller: _coinsCtrl,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'Coins to contribute',
                        labelStyle: const TextStyle(color: Colors.white54),
                        prefixIcon: const Icon(Icons.monetization_on, color: Colors.amber),
                        enabledBorder: OutlineInputBorder(borderSide: const BorderSide(color: Colors.white24), borderRadius: BorderRadius.circular(8)),
                        focusedBorder: OutlineInputBorder(borderSide: const BorderSide(color: Colors.amber), borderRadius: BorderRadius.circular(8)),
                        filled: true,
                        fillColor: Colors.grey[900],
                      ),
                    ),
                    const SizedBox(height: 16),

                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton(
                        onPressed: _contributing ? null : _contribute,
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.amber, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                        child: _contributing
                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2))
                            : const Text('Contribute', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 16)),
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}

class _PayoutRow extends StatelessWidget {
  final String label;
  final String pct;
  const _PayoutRow({required this.label, required this.pct});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 14)),
        const Spacer(),
        Text(pct, style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold, fontSize: 14)),
      ]),
    );
  }
}
