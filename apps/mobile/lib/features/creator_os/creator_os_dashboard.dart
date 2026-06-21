import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Creator OS home — the operating-system hub for a creator: studio tools,
/// planning, analytics and recording management.
class CreatorOSDashboard extends StatelessWidget {
  final String creatorId;
  const CreatorOSDashboard({super.key, required this.creatorId});

  @override
  Widget build(BuildContext context) {
    final tools = <_Tool>[
      _Tool('Poster Studio', Icons.image, '/creator-os/$creatorId/poster',
          'Generate comedy, movie, live-show & arena posters'),
      _Tool('Show Planner', Icons.event_note, '/creator-os/$creatorId/show-planner',
          'AI segment breakdowns for any show format'),
      _Tool('Revenue Analytics', Icons.bar_chart, '/creator-os/$creatorId/analytics',
          'Audience & revenue insights'),
      _Tool('Recording Manager', Icons.videocam, '/creator-os/$creatorId/recordings',
          'Record sessions & publish replays'),
    ];

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text('Creator OS'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF311B92), Color(0xFF7B1FA2)]),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text('Your Entertainment OS',
                    style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                SizedBox(height: 6),
                Text('Plan, produce, broadcast and monetize — all in one place.',
                    style: TextStyle(color: Colors.white70)),
              ],
            ),
          ),
          const SizedBox(height: 24),
          ...tools.map((t) => _ToolCard(tool: t)),
        ],
      ),
    );
  }
}

class _Tool {
  final String title;
  final IconData icon;
  final String route;
  final String subtitle;
  const _Tool(this.title, this.icon, this.route, this.subtitle);
}

class _ToolCard extends StatelessWidget {
  final _Tool tool;
  const _ToolCard({required this.tool});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 44, height: 44,
          decoration: BoxDecoration(
            color: const Color(0xFFE040FB).withOpacity(0.15),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(tool.icon, color: const Color(0xFFE040FB)),
        ),
        title: Text(tool.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        subtitle: Text(tool.subtitle, style: TextStyle(color: Colors.grey[500], fontSize: 12)),
        trailing: const Icon(Icons.chevron_right, color: Colors.grey),
        onTap: () => context.push(tool.route),
      ),
    );
  }
}
