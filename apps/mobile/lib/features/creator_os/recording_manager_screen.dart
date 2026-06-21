import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../core/config/app_config.dart';

/// Manage recording for a session room: start/stop recording, then capture the
/// stopped recording into a replay and publish it.
class RecordingManagerScreen extends StatefulWidget {
  final String roomId;
  final String creatorId;
  const RecordingManagerScreen({super.key, required this.roomId, required this.creatorId});

  @override
  State<RecordingManagerScreen> createState() => _RecordingManagerScreenState();
}

class _RecordingManagerScreenState extends State<RecordingManagerScreen> {
  Map<String, dynamic>? _recording;
  Map<String, dynamic>? _replay;
  String _status = 'idle';
  bool _busy = false;
  String? _message;

  Future<void> _startRecording() async {
    final res = await http.post(Uri.parse('${AppConfig.apiBase}/sessions/${widget.roomId}/record'));
    if (res.statusCode == 200 || res.statusCode == 201) {
      setState(() {
        _recording = jsonDecode(res.body) as Map<String, dynamic>;
        _status = 'recording';
      });
    }
  }

  Future<void> _stopRecording() async {
    final res = await http.post(Uri.parse('${AppConfig.apiBase}/sessions/${widget.roomId}/stop-recording'));
    if (res.statusCode == 200 || res.statusCode == 201) {
      setState(() {
        _recording = jsonDecode(res.body) as Map<String, dynamic>;
        _status = 'stopped';
      });
    }
  }

  Future<void> _publishReplay() async {
    if (_recording == null) return;
    // Capture → process
    final cap = await http.post(
      Uri.parse('${AppConfig.apiBase}/replays/capture'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'roomId': widget.roomId,
        'recordingId': _recording!['id'],
        'creatorId': widget.creatorId,
        'sourceRoomType': 'LIVE_EVENT',
        'rawAssetUrl': _recording!['rawAssetUrl'] ?? '',
        'durationSeconds': _recording!['durationSeconds'] ?? 0,
        'title': 'Live session replay',
      }),
    );
    if (cap.statusCode != 200 && cap.statusCode != 201) return;
    final replay = jsonDecode(cap.body) as Map<String, dynamic>;
    // Publish
    final pub = await http.post(
      Uri.parse('${AppConfig.apiBase}/replays/publish'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'replayId': replay['id'], 'visibility': 'PUBLIC'}),
    );
    if (pub.statusCode == 200 || pub.statusCode == 201) {
      setState(() {
        _replay = jsonDecode(pub.body) as Map<String, dynamic>;
        _status = 'published';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(backgroundColor: Colors.black, title: const Text('Recording Manager')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _StatusCard(status: _status),
          const SizedBox(height: 20),
          if (_status == 'idle' || _status == 'published')
            _ActionButton(
              icon: Icons.fiber_manual_record,
              label: 'Start Recording',
              color: Colors.red,
              onTap: _busy ? null : _startRecording,
            ),
          if (_status == 'recording')
            _ActionButton(
              icon: Icons.stop,
              label: 'Stop Recording',
              color: Colors.orange,
              onTap: _busy ? null : _stopRecording,
            ),
          if (_status == 'stopped')
            _ActionButton(
              icon: Icons.publish,
              label: 'Publish as Replay',
              color: const Color(0xFFE040FB),
              onTap: _busy ? null : _publishReplay,
            ),
          if (_message != null) ...[
            const SizedBox(height: 12),
            Text(_message!, style: const TextStyle(color: Colors.red)),
          ],
          if (_replay != null) ...[
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1A1A1A),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Replay Published ✓',
                      style: TextStyle(color: Color(0xFF00E676), fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  Text('ID: ${_replay!['id']}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                  Text('Visibility: ${_replay!['visibility']}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  final String status;
  const _StatusCard({required this.status});

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (status) {
      'recording' => (Colors.red, 'Recording in progress'),
      'stopped' => (Colors.orange, 'Recording stopped — ready to publish'),
      'published' => (const Color(0xFF00E676), 'Replay published'),
      _ => (Colors.grey, 'No active recording'),
    };
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color),
      ),
      child: Row(
        children: [
          Container(width: 12, height: 12,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 12),
          Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;
  const _ActionButton({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: onTap,
        style: FilledButton.styleFrom(
          backgroundColor: color,
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
        icon: Icon(icon),
        label: Text(label),
      ),
    );
  }
}
