import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import '../../core/config/app_config.dart';

class CompanionDashboardScreen extends StatefulWidget {
  final String userId;

  const CompanionDashboardScreen({super.key, required this.userId});

  @override
  State<CompanionDashboardScreen> createState() => _CompanionDashboardScreenState();
}

class _CompanionDashboardScreenState extends State<CompanionDashboardScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  bool _available = false;
  Map<String, dynamic>? _profile;
  List<Map<String, dynamic>> _upcomingSessions = [];
  List<Map<String, dynamic>> _pastSessions = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await http.get(
        Uri.parse('${AppConfig.apiBase}/companions/${widget.userId}'),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        setState(() {
          _profile = data['profile'] as Map<String, dynamic>?;
          _available = (_profile?['isAvailableNow'] as bool?) ?? false;
          _upcomingSessions = ((data['upcomingSessions'] as List?) ?? [])
              .cast<Map<String, dynamic>>();
          _pastSessions = ((data['pastSessions'] as List?) ?? [])
              .cast<Map<String, dynamic>>();
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _toggleAvailability(bool value) async {
    setState(() => _available = value);
    await http.patch(
      Uri.parse('${AppConfig.apiBase}/companions/${widget.userId}/availability'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'isAvailableNow': value}),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text('Companion Dashboard',
            style: TextStyle(color: Colors.white)),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: Colors.grey),
            onPressed: () {},
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: const Color(0xFFE040FB),
          labelColor: const Color(0xFFE040FB),
          unselectedLabelColor: Colors.grey,
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Sessions'),
            Tab(text: 'Earnings'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFE040FB)))
          : TabBarView(
              controller: _tabs,
              children: [
                _OverviewTab(
                  profile: _profile,
                  available: _available,
                  onToggleAvailability: _toggleAvailability,
                  userId: widget.userId,
                ),
                _SessionsTab(
                  upcoming: _upcomingSessions,
                  past: _pastSessions,
                  userId: widget.userId,
                ),
                _EarningsTab(profile: _profile),
              ],
            ),
    );
  }
}

// ── Overview tab ──────────────────────────────────────────────────────────────

class _OverviewTab extends StatelessWidget {
  final Map<String, dynamic>? profile;
  final bool available;
  final ValueChanged<bool> onToggleAvailability;
  final String userId;

  const _OverviewTab({
    required this.profile,
    required this.available,
    required this.onToggleAvailability,
    required this.userId,
  });

  @override
  Widget build(BuildContext context) {
    final name = (profile?['displayName'] as String?) ?? 'Companion';
    final rating = (profile?['averageRating'] as num?)?.toDouble() ?? 0.0;
    final reviews = (profile?['reviewCount'] as int?) ?? 0;
    final totalMins = (profile?['totalSessionMinutes'] as int?) ?? 0;
    final verified = (profile?['verificationBadge'] as bool?) ?? false;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // ── Profile card ──────────────────────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A1A),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 36,
                backgroundColor: const Color(0xFF2A2A2A),
                child: Text(name[0].toUpperCase(),
                    style: const TextStyle(fontSize: 30, color: Color(0xFFE040FB))),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(name,
                            style: const TextStyle(color: Colors.white,
                                fontSize: 18, fontWeight: FontWeight.bold)),
                        if (verified) ...[
                          const SizedBox(width: 6),
                          const Icon(Icons.verified, color: Colors.blue, size: 18),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.star, color: Colors.amber, size: 14),
                        Text(' ${rating.toStringAsFixed(1)}  ·  $reviews reviews',
                            style: const TextStyle(color: Colors.grey, fontSize: 13)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('${totalMins ~/ 60}h ${totalMins % 60}m total sessions',
                        style: const TextStyle(color: Colors.grey, fontSize: 12)),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // ── Availability toggle ───────────────────────────────────────────────
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A1A),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: available ? Colors.green : Colors.grey[800]!,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 10, height: 10,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: available ? Colors.green : Colors.grey,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  available ? 'Available Now' : 'Offline',
                  style: TextStyle(
                    color: available ? Colors.green : Colors.grey,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Switch(
                value: available,
                onChanged: onToggleAvailability,
                activeColor: Colors.green,
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // ── Quick stats ───────────────────────────────────────────────────────
        Row(
          children: [
            _StatCard(label: 'Rating', value: rating.toStringAsFixed(1)),
            const SizedBox(width: 12),
            _StatCard(label: 'Reviews', value: '$reviews'),
            const SizedBox(width: 12),
            _StatCard(label: 'Hours', value: '${totalMins ~/ 60}'),
          ],
        ),

        const SizedBox(height: 24),

        // ── Quick actions ─────────────────────────────────────────────────────
        const Text('Quick Actions',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 12),
        _ActionTile(
          icon: Icons.person_outline,
          label: 'Edit Profile',
          onTap: () {},
        ),
        _ActionTile(
          icon: Icons.attach_money,
          label: 'Manage Rates',
          onTap: () {},
        ),
        _ActionTile(
          icon: Icons.schedule,
          label: 'Set Availability Schedule',
          onTap: () {},
        ),
        _ActionTile(
          icon: Icons.photo_library_outlined,
          label: 'Update Intro Media',
          onTap: () {},
        ),
      ],
    );
  }
}

// ── Sessions tab ──────────────────────────────────────────────────────────────

class _SessionsTab extends StatelessWidget {
  final List<Map<String, dynamic>> upcoming;
  final List<Map<String, dynamic>> past;
  final String userId;

  const _SessionsTab({
    required this.upcoming,
    required this.past,
    required this.userId,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (upcoming.isNotEmpty) ...[
          const Text('Upcoming',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 12),
          ...upcoming.map((s) => _SessionCard(session: s, isUpcoming: true, userId: userId)),
          const SizedBox(height: 24),
        ],
        const Text('Past Sessions',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 12),
        if (past.isEmpty)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(32),
              child: Text('No sessions yet.',
                  style: TextStyle(color: Colors.grey)),
            ),
          )
        else
          ...past.map((s) => _SessionCard(session: s, isUpcoming: false, userId: userId)),
      ],
    );
  }
}

class _SessionCard extends StatelessWidget {
  final Map<String, dynamic> session;
  final bool isUpcoming;
  final String userId;

  const _SessionCard({
    required this.session,
    required this.isUpcoming,
    required this.userId,
  });

  @override
  Widget build(BuildContext context) {
    final type = (session['sessionType'] as String?) ?? 'AUDIO';
    final status = (session['status'] as String?) ?? '';
    final duration = (session['durationMinutes'] as int?) ?? 0;
    final sessionId = (session['id'] as String?) ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFE040FB).withOpacity(0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(type,
                style: const TextStyle(color: Color(0xFFE040FB), fontSize: 11,
                    fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$duration min session',
                    style: const TextStyle(color: Colors.white, fontSize: 14)),
                Text(status,
                    style: TextStyle(color: Colors.grey[600], fontSize: 12)),
              ],
            ),
          ),
          if (isUpcoming && sessionId.isNotEmpty)
            TextButton(
              onPressed: () => context.push(
                '/sessions/$sessionId/${type == 'VIDEO' ? 'video' : 'audio'}',
                extra: {'userId': userId, 'companionName': 'Session'},
              ),
              child: const Text('Join', style: TextStyle(color: Color(0xFFE040FB))),
            ),
        ],
      ),
    );
  }
}

// ── Earnings tab ──────────────────────────────────────────────────────────────

class _EarningsTab extends StatelessWidget {
  final Map<String, dynamic>? profile;

  const _EarningsTab({required this.profile});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A1A),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Lifetime Earnings',
                  style: TextStyle(color: Colors.grey, fontSize: 13)),
              const SizedBox(height: 8),
              const Text('— coins',
                  style: TextStyle(color: Colors.white, fontSize: 32,
                      fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              const Text('Payout history available in Sprint 8',
                  style: TextStyle(color: Colors.grey, fontSize: 12)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A1A),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Column(
            children: [
              _EarningsRow(label: 'Platform fee', value: '20%'),
              Divider(color: Color(0xFF2A2A2A)),
              _EarningsRow(label: 'Your share', value: '80%', highlight: true),
            ],
          ),
        ),
      ],
    );
  }
}

class _EarningsRow extends StatelessWidget {
  final String label;
  final String value;
  final bool highlight;

  const _EarningsRow({
    required this.label,
    required this.value,
    this.highlight = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey)),
          Text(value,
              style: TextStyle(
                color: highlight ? const Color(0xFFE040FB) : Colors.white,
                fontWeight: highlight ? FontWeight.bold : FontWeight.normal,
              )),
        ],
      ),
    );
  }
}

// ── Shared widgets ────────────────────────────────────────────────────────────

class _StatCard extends StatelessWidget {
  final String label;
  final String value;

  const _StatCard({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: const Color(0xFF1A1A1A),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          children: [
            Text(value,
                style: const TextStyle(color: Colors.white, fontSize: 22,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionTile({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
      leading: Icon(icon, color: const Color(0xFFE040FB), size: 22),
      title: Text(label, style: const TextStyle(color: Colors.white)),
      trailing: const Icon(Icons.chevron_right, color: Colors.grey),
      onTap: onTap,
    );
  }
}
