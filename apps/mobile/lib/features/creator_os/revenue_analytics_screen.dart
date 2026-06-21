import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../core/config/app_config.dart';

/// Revenue + audience analytics dashboard backed by GET /creator-os/analytics.
class RevenueAnalyticsScreen extends StatefulWidget {
  final String creatorId;
  const RevenueAnalyticsScreen({super.key, required this.creatorId});

  @override
  State<RevenueAnalyticsScreen> createState() => _RevenueAnalyticsScreenState();
}

class _RevenueAnalyticsScreenState extends State<RevenueAnalyticsScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await http.get(Uri.parse(
          '${AppConfig.apiBase}/creator-os/analytics?creatorId=${widget.creatorId}'));
      if (res.statusCode == 200) {
        setState(() => _data = jsonDecode(res.body) as Map<String, dynamic>);
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(backgroundColor: Colors.black, title: const Text('Revenue Analytics')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFE040FB)))
          : _data == null
              ? const Center(child: Text('No data', style: TextStyle(color: Colors.grey)))
              : _buildBody(),
    );
  }

  Widget _buildBody() {
    final revenue = _data!['revenue'] as Map<String, dynamic>;
    final audience = _data!['audience'] as Map<String, dynamic>;
    final insights = _data!['insights'] as Map<String, dynamic>;
    final breakdown = (revenue['breakdown'] as List?) ?? [];
    final trend = (revenue['trend'] as List?) ?? [];
    final maxCoins = trend.isEmpty ? 1 : trend
        .map((t) => (t['coins'] as num).toDouble())
        .reduce((a, b) => a > b ? a : b);

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // ── Net earnings card ─────────────────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [Color(0xFF7B1FA2), Color(0xFFE040FB)]),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Net Earnings (30d)', style: TextStyle(color: Colors.white70)),
              const SizedBox(height: 6),
              Text('${revenue['netCoins']} coins',
                  style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold)),
              Text('Gross ${revenue['grossCoins']} · Fee ${revenue['platformFeeCoins']}',
                  style: const TextStyle(color: Colors.white70, fontSize: 12)),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ── Trend bars ────────────────────────────────────────────────────────
        const Text('Daily Trend', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        SizedBox(
          height: 120,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: trend.map<Widget>((t) {
              final h = (t['coins'] as num).toDouble() / maxCoins;
              return Expanded(
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  height: 120 * h,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE040FB),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 24),

        // ── Breakdown ─────────────────────────────────────────────────────────
        const Text('Revenue Sources', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        ...breakdown.map((b) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text((b['source'] as String).replaceAll('_', ' '),
                  style: const TextStyle(color: Colors.grey)),
              Text('${b['coins']} coins', style: const TextStyle(color: Colors.white)),
            ],
          ),
        )),
        const SizedBox(height: 24),

        // ── Audience ──────────────────────────────────────────────────────────
        Row(
          children: [
            _Stat(label: 'Followers', value: '${audience['followers']}'),
            const SizedBox(width: 12),
            _Stat(label: 'Supporters', value: '${audience['activeSupporters']}'),
            const SizedBox(width: 12),
            _Stat(label: 'Patrons', value: '${audience['patrons']}'),
          ],
        ),
        const SizedBox(height: 24),

        // ── Insights ──────────────────────────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A1A),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: const [
                Icon(Icons.lightbulb_outline, color: Color(0xFFFFD600), size: 18),
                SizedBox(width: 6),
                Text('Insights', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ]),
              const SizedBox(height: 8),
              Text((insights['headline'] as String?) ?? '',
                  style: const TextStyle(color: Colors.white70)),
              const SizedBox(height: 8),
              ...(((insights['recommendations'] as List?) ?? []).map((r) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Text('• $r', style: TextStyle(color: Colors.grey[400], fontSize: 13)),
              ))),
            ],
          ),
        ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  const _Stat({required this.label, required this.value});

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
            Text(value, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
