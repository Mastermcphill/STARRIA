import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import '../../core/config/app_config.dart';

class SessionTimerScreen extends StatefulWidget {
  final String sessionId;
  final String userId;
  final String sessionType;

  const SessionTimerScreen({
    super.key,
    required this.sessionId,
    required this.userId,
    required this.sessionType,
  });

  @override
  State<SessionTimerScreen> createState() => _SessionTimerScreenState();
}

class _SessionTimerScreenState extends State<SessionTimerScreen> {
  Timer? _timer;
  int _elapsedSeconds = 0;
  int _totalSeconds   = 30 * 60; // default 30 min; updated after start
  bool _started       = false;
  bool _showExtend    = false;
  bool _extending     = false;
  bool _ending        = false;

  @override
  void initState() {
    super.initState();
    _startSession();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _startSession() async {
    try {
      final res = await http.post(
        Uri.parse('${AppConfig.apiBase}/sessions/start'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'sessionId': widget.sessionId}),
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final mins = (data['durationMinutes'] as int?) ?? 30;
        setState(() {
          _totalSeconds = mins * 60;
          _started = true;
        });
        _timer = Timer.periodic(const Duration(seconds: 1), (_) {
          setState(() {
            _elapsedSeconds++;
            // Show extend prompt at 5 min remaining
            final remaining = _totalSeconds - _elapsedSeconds;
            if (remaining == 300) _showExtend = true;
            if (_elapsedSeconds >= _totalSeconds) _endSession();
          });
        });
      }
    } catch (_) {}
  }

  Future<void> _extendSession(int addMinutes) async {
    setState(() => _extending = true);
    try {
      await http.post(
        Uri.parse('${AppConfig.apiBase}/bookings/${widget.sessionId}/extend'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'sessionId': widget.sessionId,
          'patronId': widget.userId,
          'addedMinutes': addMinutes,
          'coinCostPerMinute': 10,
        }),
      );
      setState(() {
        _totalSeconds += addMinutes * 60;
        _showExtend = false;
      });
    } finally {
      if (mounted) setState(() => _extending = false);
    }
  }

  Future<void> _endSession() async {
    _timer?.cancel();
    setState(() => _ending = true);
    try {
      await http.post(
        Uri.parse('${AppConfig.apiBase}/sessions/end'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'sessionId': widget.sessionId}),
      );
    } finally {
      if (mounted) context.go('/companion/dashboard/${widget.userId}');
    }
  }

  Future<void> _panicLeave() async {
    _timer?.cancel();
    await http.post(
      Uri.parse('${AppConfig.apiBase}/sessions/panic-leave'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'sessionId': widget.sessionId, 'userId': widget.userId}),
    );
    if (mounted) context.go('/');
  }

  String _format(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final remaining = _totalSeconds - _elapsedSeconds;
    final progress  = _totalSeconds > 0 ? _elapsedSeconds / _totalSeconds : 0.0;
    final isWarning = remaining <= 300 && remaining > 0;

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            // ── Top bar ──────────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.red,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(widget.sessionType,
                        style: const TextStyle(color: Colors.white, fontSize: 12,
                            fontWeight: FontWeight.bold)),
                  ),
                  const Spacer(),
                  // Panic leave
                  TextButton.icon(
                    onPressed: _panicLeave,
                    icon: const Icon(Icons.exit_to_app, color: Colors.red, size: 16),
                    label: const Text('Leave', style: TextStyle(color: Colors.red)),
                  ),
                ],
              ),
            ),

            const Spacer(),

            // ── Timer ring ───────────────────────────────────────────────────
            SizedBox(
              width: 220,
              height: 220,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  CircularProgressIndicator(
                    value: 1 - progress.clamp(0, 1),
                    strokeWidth: 12,
                    backgroundColor: const Color(0xFF2A2A2A),
                    valueColor: AlwaysStoppedAnimation(
                        isWarning ? Colors.red : const Color(0xFFE040FB)),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _format(remaining.clamp(0, _totalSeconds)),
                        style: TextStyle(
                          color: isWarning ? Colors.red : Colors.white,
                          fontSize: 48,
                          fontWeight: FontWeight.bold,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                      Text('remaining',
                          style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),
            Text('Elapsed: ${_format(_elapsedSeconds)}',
                style: const TextStyle(color: Colors.grey)),

            const Spacer(),

            // ── Extend prompt ────────────────────────────────────────────────
            if (_showExtend)
              AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                margin: const EdgeInsets.symmetric(horizontal: 20),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1A1A1A),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE040FB)),
                ),
                child: Column(
                  children: [
                    const Text('5 minutes remaining — extend?',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [15, 30].map((mins) => FilledButton(
                        onPressed: _extending ? null : () => _extendSession(mins),
                        style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE040FB)),
                        child: Text('+$mins min'),
                      )).toList(),
                    ),
                    TextButton(
                      onPressed: () => setState(() => _showExtend = false),
                      child: const Text('No thanks', style: TextStyle(color: Colors.grey)),
                    ),
                  ],
                ),
              ),

            // ── End session ───────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.all(20),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: _ending ? null : _endSession,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red,
                    side: const BorderSide(color: Colors.red),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: _ending
                      ? const SizedBox(height: 18, width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.red))
                      : const Text('End Session'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
