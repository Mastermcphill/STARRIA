import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../events/events_provider.dart';

class PosterStudioScreen extends ConsumerStatefulWidget {
  const PosterStudioScreen({super.key});

  @override
  ConsumerState<PosterStudioScreen> createState() => _PosterStudioScreenState();
}

class _PosterStudioScreenState extends ConsumerState<PosterStudioScreen> {
  final _titleCtrl = TextEditingController();
  String _selectedType = 'LIVE_STREAM';
  String _selectedStyle = 'bold';
  bool _generating = false;
  Map<String, dynamic>? _result;
  String? _error;

  static const _eventTypes = [
    ('📡 Live Stream', 'LIVE_STREAM'),
    ('😂 Comedy Show', 'COMEDY_SHOW'),
    ('🤖 AI Premiere', 'AI_PREMIERE'),
    ('🎤 Rap Battle', 'RAP_BATTLE'),
    ('🎵 Sing-Off', 'SING_OFF'),
    ('❓ Creator Q&A', 'CREATOR_QA'),
    ('🗣️ Yap Battle', 'YAP_BATTLE'),
    ('💜 Supporter Room', 'SUPPORTER_ROOM'),
  ];

  static const _styles = [
    ('Bold', 'bold'),
    ('Minimal', 'minimal'),
    ('Cinematic', 'cinematic'),
    ('Neon', 'neon'),
    ('Afrobeats', 'afrobeats'),
  ];

  @override
  void dispose() {
    _titleCtrl.dispose();
    super.dispose();
  }

  Future<void> _generate() async {
    if (_titleCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Please enter a title');
      return;
    }
    setState(() { _generating = true; _error = null; _result = null; });
    try {
      final result = await ref.read(posterGenerationProvider.notifier).generate(
        title: _titleCtrl.text.trim(),
        eventType: _selectedType,
        style: _selectedStyle,
      );
      setState(() { _result = result; _generating = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _generating = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D0D1A),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text('Poster Studio', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Chip(
              label: const Text('50 coins', style: TextStyle(color: Color(0xFFE040FB), fontSize: 12)),
              backgroundColor: const Color(0xFF1A1A2E),
              side: const BorderSide(color: Color(0xFFE040FB)),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Preview area
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              height: 200,
              width: double.infinity,
              decoration: BoxDecoration(
                color: const Color(0xFF1A1A2E),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white12),
              ),
              child: _result != null
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.network(
                        _result!['resultImageUrl'] as String,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const _PosterPlaceholder(),
                      ),
                    )
                  : const _PosterPlaceholder(),
            ),
            if (_result != null) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  const Icon(Icons.check_circle, color: Color(0xFF00BFA5), size: 18),
                  const SizedBox(width: 8),
                  Text(
                    'Generated in ${_result!['generationMs']}ms — charged ${_result!['coinsCharged']} coins',
                    style: const TextStyle(color: Colors.white54, fontSize: 13),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 28),
            // Title
            const Text('Event Title', style: TextStyle(color: Colors.white70, fontSize: 13)),
            const SizedBox(height: 8),
            TextField(
              controller: _titleCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'e.g. Friday Night Comedy Roast',
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
            const SizedBox(height: 20),
            // Event type
            const Text('Event Type', style: TextStyle(color: Colors.white70, fontSize: 13)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _eventTypes.map((t) => GestureDetector(
                onTap: () => setState(() => _selectedType = t.$2),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: _selectedType == t.$2
                        ? const Color(0xFFE040FB).withOpacity(0.2)
                        : const Color(0xFF1A1A2E),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: _selectedType == t.$2
                          ? const Color(0xFFE040FB)
                          : Colors.white24,
                    ),
                  ),
                  child: Text(t.$1,
                      style: TextStyle(
                        color: _selectedType == t.$2 ? const Color(0xFFE040FB) : Colors.white70,
                        fontSize: 13,
                      )),
                ),
              )).toList(),
            ),
            const SizedBox(height: 20),
            // Style
            const Text('Visual Style', style: TextStyle(color: Colors.white70, fontSize: 13)),
            const SizedBox(height: 8),
            Row(
              children: _styles.map((s) => Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _selectedStyle = s.$2),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    margin: const EdgeInsets.only(right: 6),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: _selectedStyle == s.$2
                          ? const Color(0xFFE040FB)
                          : const Color(0xFF1A1A2E),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(s.$1,
                          style: TextStyle(
                            color: _selectedStyle == s.$2 ? Colors.white : Colors.white54,
                            fontSize: 12,
                            fontWeight: _selectedStyle == s.$2 ? FontWeight.bold : FontWeight.normal,
                          )),
                    ),
                  ),
                ),
              )).toList(),
            ),
            const SizedBox(height: 28),
            // Error
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.redAccent),
                ),
                child: Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 13)),
              ),
              const SizedBox(height: 16),
            ],
            // Generate button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _generating ? null : _generate,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFE040FB),
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: _generating
                    ? const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(width: 20, height: 20,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                          SizedBox(width: 12),
                          Text('Generating...', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        ],
                      )
                    : const Text('Generate Poster (50 coins)',
                        style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}

class _PosterPlaceholder extends StatelessWidget {
  const _PosterPlaceholder();
  @override
  Widget build(BuildContext context) => const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.auto_awesome, size: 48, color: Colors.white24),
            SizedBox(height: 12),
            Text('Your poster will appear here',
                style: TextStyle(color: Colors.white38, fontSize: 14)),
          ],
        ),
      );
}
