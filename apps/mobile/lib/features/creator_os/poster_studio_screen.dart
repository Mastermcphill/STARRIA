import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../core/config/app_config.dart';

/// AI Poster Studio — generate comedy / AI-movie / live-show / arena posters
/// via POST /creator-os/poster (charges coins).
class CreatorPosterStudioScreen extends StatefulWidget {
  final String creatorId;
  const CreatorPosterStudioScreen({super.key, required this.creatorId});

  @override
  State<CreatorPosterStudioScreen> createState() => _CreatorPosterStudioScreenState();
}

class _CreatorPosterStudioScreenState extends State<CreatorPosterStudioScreen> {
  String _type = 'COMEDY';
  final _title = TextEditingController();
  final _prompt = TextEditingController();
  Map<String, dynamic>? _result;
  bool _loading = false;
  String? _error;

  final _types = {
    'COMEDY': 50,
    'AI_MOVIE': 120,
    'LIVE_SHOW': 60,
    'ARENA': 80,
  };

  @override
  void dispose() {
    _title.dispose();
    _prompt.dispose();
    super.dispose();
  }

  Future<void> _generate() async {
    if (_title.text.trim().isEmpty) {
      setState(() => _error = 'Title is required.');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final res = await http.post(
        Uri.parse('${AppConfig.apiBase}/creator-os/poster'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'creatorId': widget.creatorId,
          'posterType': _type,
          'title': _title.text.trim(),
          'prompt': _prompt.text.trim(),
        }),
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        setState(() => _result = jsonDecode(res.body) as Map<String, dynamic>);
      } else {
        setState(() => _error = 'Generation failed (${res.statusCode}).');
      }
    } catch (e) {
      setState(() => _error = 'Network error: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cost = _types[_type]!;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(backgroundColor: Colors.black, title: const Text('Poster Studio')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Poster Type', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: _types.keys.map((t) => ChoiceChip(
              label: Text(t.replaceAll('_', ' ')),
              selected: _type == t,
              onSelected: (_) => setState(() => _type = t),
              selectedColor: const Color(0xFFE040FB),
              labelStyle: TextStyle(color: _type == t ? Colors.white : Colors.grey),
            )).toList(),
          ),
          const SizedBox(height: 20),
          _Field(controller: _title, label: 'Title'),
          const SizedBox(height: 12),
          _Field(controller: _prompt, label: 'Describe your poster', maxLines: 3),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _loading ? null : _generate,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFE040FB),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              icon: const Icon(Icons.image),
              label: Text(_loading ? 'Generating…' : 'Generate — $cost coins'),
            ),
          ),
          const SizedBox(height: 24),
          if (_result != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                _result!['resultImageUrl'] as String,
                errorBuilder: (_, __, ___) => Container(
                  height: 280,
                  color: const Color(0xFF1A1A1A),
                  child: const Center(child: Icon(Icons.broken_image, color: Colors.grey, size: 48)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final int maxLines;
  const _Field({required this.controller, required this.label, this.maxLines = 1});

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Colors.grey),
        enabledBorder: OutlineInputBorder(
          borderSide: BorderSide(color: Colors.grey[700]!),
          borderRadius: BorderRadius.circular(8),
        ),
        focusedBorder: OutlineInputBorder(
          borderSide: const BorderSide(color: Color(0xFFE040FB)),
          borderRadius: BorderRadius.circular(8),
        ),
      ),
    );
  }
}
