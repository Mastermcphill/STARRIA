import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../core/config/app_config.dart';

/// AI Show Planner — pick a show type, duration and audience size, then
/// generate a segment breakdown via POST /creator-os/show-plan.
class ShowPlannerScreen extends StatefulWidget {
  final String creatorId;
  const ShowPlannerScreen({super.key, required this.creatorId});

  @override
  State<ShowPlannerScreen> createState() => _ShowPlannerScreenState();
}

class _ShowPlannerScreenState extends State<ShowPlannerScreen> {
  String _showType = 'STANDUP';
  double _duration = 60;
  double _audience = 100;
  List<Map<String, dynamic>> _segments = [];
  bool _loading = false;

  final _types = ['STANDUP', 'RAP_BATTLE', 'SING_OFF', 'QA', 'AI_PREMIERE'];

  Future<void> _generate() async {
    setState(() => _loading = true);
    try {
      final res = await http.post(
        Uri.parse('${AppConfig.apiBase}/creator-os/show-plan'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'creatorId': widget.creatorId,
          'showType': _showType,
          'durationMinutes': _duration.round(),
          'audienceSize': _audience.round(),
        }),
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        setState(() => _segments = ((data['segments'] as List?) ?? []).cast<Map<String, dynamic>>());
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(backgroundColor: Colors.black, title: const Text('Show Planner')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Show Type', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: _types.map((t) => ChoiceChip(
              label: Text(t.replaceAll('_', ' ')),
              selected: _showType == t,
              onSelected: (_) => setState(() => _showType = t),
              selectedColor: const Color(0xFFE040FB),
              labelStyle: TextStyle(color: _showType == t ? Colors.white : Colors.grey),
            )).toList(),
          ),
          const SizedBox(height: 20),
          Text('Duration: ${_duration.round()} min', style: const TextStyle(color: Colors.white70)),
          Slider(
            value: _duration, min: 15, max: 180, divisions: 11,
            activeColor: const Color(0xFFE040FB),
            label: '${_duration.round()}',
            onChanged: (v) => setState(() => _duration = v),
          ),
          Text('Audience size: ${_audience.round()}', style: const TextStyle(color: Colors.white70)),
          Slider(
            value: _audience, min: 5, max: 5000, divisions: 50,
            activeColor: const Color(0xFFE040FB),
            label: '${_audience.round()}',
            onChanged: (v) => setState(() => _audience = v),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _loading ? null : _generate,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFE040FB),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              icon: const Icon(Icons.auto_awesome),
              label: Text(_loading ? 'Generating…' : 'Generate Plan'),
            ),
          ),
          const SizedBox(height: 24),
          if (_segments.isNotEmpty) ...[
            const Text('Run of Show',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            ..._segments.map((s) => _SegmentRow(segment: s)),
          ],
        ],
      ),
    );
  }
}

class _SegmentRow extends StatelessWidget {
  final Map<String, dynamic> segment;
  const _SegmentRow({required this.segment});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: const Color(0xFFE040FB),
            child: Text('${segment['order']}', style: const TextStyle(color: Colors.white, fontSize: 13)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text((segment['title'] as String?) ?? '',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                Text((segment['description'] as String?) ?? '',
                    style: TextStyle(color: Colors.grey[500], fontSize: 12)),
              ],
            ),
          ),
          Text('${segment['minutes']} min',
              style: const TextStyle(color: Color(0xFFE040FB), fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
