import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'prestige_provider.dart';

class CampaignManagerScreen extends ConsumerStatefulWidget {
  final String starId;
  const CampaignManagerScreen({super.key, required this.starId});

  @override
  ConsumerState<CampaignManagerScreen> createState() => _CampaignManagerScreenState();
}

class _CampaignManagerScreenState extends ConsumerState<CampaignManagerScreen> {
  String _selectedScope = 'LOCAL';
  String _selectedType = 'VIDEO';
  String _promotableId = '';
  bool _creating = false;
  String? _error;
  Map<String, dynamic>? _success;

  static const _scopes = [
    ('Local',   'LOCAL',   50),
    ('Country', 'COUNTRY', 150),
    ('Global',  'GLOBAL',  400),
  ];

  static const _types = [
    ('🎬 Video',       'VIDEO'),
    ('👤 Creator',     'CREATOR'),
    ('📡 Live',        'LIVE_SESSION'),
    ('🎫 Event',       'EVENT'),
  ];

  static const _scopeCosts = {
    'LOCAL':   {'VIDEO': 50,  'CREATOR': 100, 'LIVE_SESSION': 75,  'EVENT': 80},
    'COUNTRY': {'VIDEO': 150, 'CREATOR': 300, 'LIVE_SESSION': 200, 'EVENT': 250},
    'GLOBAL':  {'VIDEO': 400, 'CREATOR': 800, 'LIVE_SESSION': 500, 'EVENT': 600},
  };

  int get _coinCost => _scopeCosts[_selectedScope]?[_selectedType] ?? 50;

  Future<void> _create() async {
    if (_promotableId.trim().isEmpty) {
      setState(() => _error = 'Enter the ID of the content to promote');
      return;
    }
    setState(() { _creating = true; _error = null; _success = null; });
    try {
      final result = await ref.read(createCampaignProvider.notifier).create(
        starId: widget.starId,
        promotableType: _selectedType,
        promotableId: _promotableId.trim(),
        scope: _selectedScope,
      );
      setState(() { _success = result['campaign'] as Map<String, dynamic>?; _creating = false; });
      ref.invalidate(myCampaignsProvider(widget.starId));
    } catch (e) {
      setState(() { _error = e.toString(); _creating = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final campaignsAsync = ref.watch(myCampaignsProvider(widget.starId));

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D0D1A),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text('Campaign Manager', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Create section
            const Text('Launch a Visibility Campaign',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 4),
            const Text('Boost your content in discovery feeds across STARRIA.',
                style: TextStyle(color: Colors.white54, fontSize: 13)),
            const SizedBox(height: 20),

            // Scope
            const Text('Reach', style: TextStyle(color: Colors.white70, fontSize: 13)),
            const SizedBox(height: 8),
            Row(
              children: _scopes.map((s) => Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _selectedScope = s.$2),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    margin: const EdgeInsets.only(right: 6),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: _selectedScope == s.$2
                          ? const Color(0xFFE040FB)
                          : const Color(0xFF1A1A2E),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(s.$1,
                              style: TextStyle(
                                color: _selectedScope == s.$2 ? Colors.white : Colors.white54,
                                fontWeight: FontWeight.bold, fontSize: 13,
                              )),
                          Text('from ${s.$3}c',
                              style: TextStyle(
                                color: _selectedScope == s.$2 ? Colors.white70 : Colors.white38,
                                fontSize: 11,
                              )),
                        ],
                      ),
                    ),
                  ),
                ),
              )).toList(),
            ),
            const SizedBox(height: 20),

            // Type
            const Text('What to promote', style: TextStyle(color: Colors.white70, fontSize: 13)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _types.map((t) {
                final selected = _selectedType == t.$2;
                return GestureDetector(
                  onTap: () => setState(() => _selectedType = t.$2),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: selected ? const Color(0xFFE040FB).withOpacity(0.2) : const Color(0xFF1A1A2E),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: selected ? const Color(0xFFE040FB) : Colors.white24),
                    ),
                    child: Text(t.$1,
                        style: TextStyle(
                          color: selected ? const Color(0xFFE040FB) : Colors.white54,
                          fontSize: 13,
                        )),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // Promotable ID
            const Text('Content ID', style: TextStyle(color: Colors.white70, fontSize: 13)),
            const SizedBox(height: 8),
            TextField(
              style: const TextStyle(color: Colors.white),
              onChanged: (v) => setState(() => _promotableId = v),
              decoration: InputDecoration(
                hintText: 'e.g. video-abc123 or event-xyz',
                hintStyle: const TextStyle(color: Colors.white38),
                filled: true,
                fillColor: const Color(0xFF1A1A2E),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFE040FB)),
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Cost summary
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF1A1A2E),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE040FB).withOpacity(0.3)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Campaign cost', style: TextStyle(color: Colors.white70)),
                  Text('$_coinCost coins',
                      style: const TextStyle(color: Color(0xFFE040FB), fontWeight: FontWeight.bold, fontSize: 16)),
                ],
              ),
            ),

            if (_error != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.redAccent),
                ),
                child: Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 13)),
              ),
            ],

            if (_success != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF00BFA5).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF00BFA5)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle, color: Color(0xFF00BFA5), size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Campaign launched! ID: ${_success!['id'] ?? ''}',
                        style: const TextStyle(color: Color(0xFF00BFA5), fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _creating ? null : _create,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFE040FB),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: _creating
                    ? const Row(mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(width: 20, height: 20,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                          SizedBox(width: 12),
                          Text('Launching...', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        ])
                    : Text('Launch Campaign ($_coinCost coins)',
                        style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
              ),
            ),

            const SizedBox(height: 32),
            const Text('My Campaigns',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 12),

            campaignsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFFE040FB))),
              error: (e, _) => Text('$e', style: const TextStyle(color: Colors.redAccent, fontSize: 12)),
              data: (campaigns) {
                if (campaigns.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.all(16),
                    child: Center(child: Text('No campaigns yet', style: TextStyle(color: Colors.white38))),
                  );
                }
                return Column(
                  children: campaigns.map((c) => _CampaignTile(campaign: c)).toList(),
                );
              },
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}

class _CampaignTile extends StatelessWidget {
  final Map<String, dynamic> campaign;
  const _CampaignTile({required this.campaign});

  @override
  Widget build(BuildContext context) {
    final scope = campaign['scope'] as String? ?? 'LOCAL';
    final type = campaign['promotableType'] as String? ?? 'VIDEO';
    final status = campaign['status'] as String? ?? 'ACTIVE';
    final coins = (campaign['coinsSpent'] as num?)?.toInt() ?? 0;
    final isActive = status == 'ACTIVE';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(12),
        border: isActive ? Border.all(color: const Color(0xFFE040FB).withOpacity(0.4)) : null,
      ),
      child: Row(
        children: [
          Container(
            width: 42, height: 42,
            decoration: BoxDecoration(
              color: isActive
                  ? const Color(0xFFE040FB).withOpacity(0.15)
                  : Colors.white12,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(child: Text(
              scope == 'GLOBAL' ? '🌍' : scope == 'COUNTRY' ? '🇳🇬' : '📍',
              style: const TextStyle(fontSize: 20),
            )),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$scope · $type',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                Text('$coins coins spent',
                    style: const TextStyle(color: Colors.white38, fontSize: 12)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: isActive
                  ? const Color(0xFF00BFA5).withOpacity(0.15)
                  : Colors.white12,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(status,
                style: TextStyle(
                  color: isActive ? const Color(0xFF00BFA5) : Colors.white38,
                  fontSize: 11, fontWeight: FontWeight.bold,
                )),
          ),
        ],
      ),
    );
  }
}
