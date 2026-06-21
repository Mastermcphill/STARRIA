import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../core/config/app_config.dart';

/// Plays back a published replay. Resolves the gated playback URL from the API
/// (enforcing subscriber/premium access) then surfaces the player.
/// The actual HLS player is wired in Sprint 8; this renders the poster + meta.
class ReplayScreen extends StatefulWidget {
  final String replayId;
  final String userId;

  const ReplayScreen({super.key, required this.replayId, required this.userId});

  @override
  State<ReplayScreen> createState() => _ReplayScreenState();
}

class _ReplayScreenState extends State<ReplayScreen> {
  Map<String, dynamic>? _replay;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await http.get(Uri.parse(
          '${AppConfig.apiBase}/replays/${widget.replayId}?userId=${widget.userId}'));
      if (res.statusCode == 200) {
        setState(() => _replay = jsonDecode(res.body) as Map<String, dynamic>);
      } else {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        setState(() => _error = (body['message'] ?? 'Unable to load replay').toString());
      }
    } catch (e) {
      setState(() => _error = 'Network error: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(backgroundColor: Colors.black, title: const Text('Replay')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFE040FB)))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.lock_outline, color: Colors.grey, size: 48),
                        const SizedBox(height: 12),
                        Text(_error!, textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.grey)),
                      ],
                    ),
                  ),
                )
              : _buildReplay(),
    );
  }

  Widget _buildReplay() {
    final r = _replay!;
    return ListView(
      children: [
        AspectRatio(
          aspectRatio: 16 / 9,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if ((r['posterUrl'] as String?)?.isNotEmpty ?? false)
                Image.network(r['posterUrl'] as String, fit: BoxFit.cover)
              else
                Container(color: const Color(0xFF1A1A1A)),
              const Center(
                child: Icon(Icons.play_circle_fill, color: Colors.white, size: 64),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text((r['title'] as String?) ?? 'Replay',
                  style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Row(
                children: [
                  _Chip((r['visibility'] as String?) ?? 'PUBLIC'),
                  const SizedBox(width: 8),
                  Text('${r['viewCount'] ?? 0} views',
                      style: const TextStyle(color: Colors.grey)),
                  const Spacer(),
                  Text('${((r['durationSeconds'] as int?) ?? 0) ~/ 60} min',
                      style: const TextStyle(color: Colors.grey)),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  const _Chip(this.label);
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: const Color(0xFFE040FB).withOpacity(0.18),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(label, style: const TextStyle(color: Color(0xFFE040FB), fontSize: 11, fontWeight: FontWeight.bold)),
      );
}
