import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../../../core/config/api_config.dart';
import 'battle_models.dart';

class HouseProfileScreen extends ConsumerStatefulWidget {
  final String houseId;
  const HouseProfileScreen({super.key, required this.houseId});

  @override
  ConsumerState<HouseProfileScreen> createState() => _HouseProfileScreenState();
}

class _HouseProfileScreenState extends ConsumerState<HouseProfileScreen> {
  Map<String, dynamic>? _house;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await http.get(Uri.parse('${ApiConfig.baseUrl}/arenas/houses/${widget.houseId}'));
      if (res.statusCode == 200 && mounted) {
        setState(() {
          _house = jsonDecode(res.body) as Map<String, dynamic>;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(backgroundColor: Colors.black, body: Center(child: CircularProgressIndicator(color: Colors.amber)));

    final h = _house;
    if (h == null) {
      return Scaffold(backgroundColor: Colors.black, appBar: AppBar(backgroundColor: Colors.black, iconTheme: const IconThemeData(color: Colors.white)), body: const Center(child: Text('House not found', style: TextStyle(color: Colors.white38))));
    }

    final members = (h['members'] as List<dynamic>? ?? []);

    return Scaffold(
      backgroundColor: Colors.black,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 200,
            pinned: true,
            backgroundColor: Colors.black,
            iconTheme: const IconThemeData(color: Colors.white),
            flexibleSpace: FlexibleSpaceBar(
              title: Text(h['name'] as String? ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.amber.withOpacity(0.3), Colors.black],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
                child: const Center(child: Icon(Icons.home, color: Colors.amber, size: 64)),
              ),
            ),
          ),

          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(delegate: SliverChildListDelegate([
              // Stats row
              Row(children: [
                _StatBox(label: 'Members', value: '${h['memberCount'] ?? members.length}'),
                const SizedBox(width: 12),
                _StatBox(label: 'Battles', value: '0'),
                const SizedBox(width: 12),
                _StatBox(label: 'Rep', value: '—'),
              ]),
              const SizedBox(height: 16),

              // Description
              if (h['description'] != null) ...[
                Text(h['description'] as String, style: const TextStyle(color: Colors.white70, fontSize: 14)),
                const SizedBox(height: 16),
              ],

              // Roles
              const Text('Roles', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 8),
              Wrap(spacing: 8, children: [
                for (final role in ['Owner', 'Admin', 'Member', 'Prospect'])
                  Chip(
                    label: Text(role, style: const TextStyle(color: Colors.white, fontSize: 12)),
                    backgroundColor: Colors.grey[850],
                    side: const BorderSide(color: Colors.white12),
                  ),
              ]),
              const SizedBox(height: 16),

              // Members
              const Text('Members', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 8),
              ...members.take(10).map((m) {
                final member = m as Map<String, dynamic>;
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const CircleAvatar(backgroundColor: Colors.grey, child: Icon(Icons.person, color: Colors.white)),
                  title: Text(member['starProfileId'] as String? ?? '...', style: const TextStyle(color: Colors.white)),
                  subtitle: Text(member['role'] as String? ?? 'MEMBER', style: const TextStyle(color: Colors.white38, fontSize: 12)),
                  trailing: const Icon(Icons.chevron_right, color: Colors.white24),
                );
              }),

              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {},
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.amber, foregroundColor: Colors.black, padding: const EdgeInsets.symmetric(vertical: 14)),
                  icon: const Icon(Icons.person_add),
                  label: const Text('Request to Join', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ])),
          ),
        ],
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  final String label;
  final String value;
  const _StatBox({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(color: Colors.grey[900], borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.white12)),
        child: Column(children: [
          Text(value, style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold, fontSize: 20)),
          Text(label, style: const TextStyle(color: Colors.white38, fontSize: 12)),
        ]),
      ),
    );
  }
}
