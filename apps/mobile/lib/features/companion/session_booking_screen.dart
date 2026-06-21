import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import '../../core/config/app_config.dart';

class SessionBookingScreen extends StatefulWidget {
  final String companionId;
  final String userId;

  const SessionBookingScreen({
    super.key,
    required this.companionId,
    required this.userId,
  });

  @override
  State<SessionBookingScreen> createState() => _SessionBookingScreenState();
}

class _SessionBookingScreenState extends State<SessionBookingScreen> {
  String _sessionType = 'AUDIO';
  int _durationMinutes = 30;
  DateTime? _scheduledAt;
  bool _booking = false;
  String? _error;

  final _durations = [15, 30, 45, 60];
  final _sessionTypes = ['AUDIO', 'VIDEO', 'GROUP', 'PRIVATE'];

  // Coin costs lookup (in real app — fetched from /companions/:id rates)
  int get _estimatedCost => switch (_durationMinutes) {
    15 => 150,
    30 => 280,
    45 => 400,
    60 => 500,
    _ => 280,
  };

  Future<void> _pickSchedule() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(hours: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 30)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.now());
    if (time == null) return;
    setState(() => _scheduledAt = DateTime(
      date.year, date.month, date.day, time.hour, time.minute,
    ));
  }

  Future<void> _book() async {
    if (_scheduledAt == null) {
      setState(() => _error = 'Please select a time.');
      return;
    }
    setState(() { _booking = true; _error = null; });
    try {
      final res = await http.post(
        Uri.parse('${AppConfig.apiBase}/bookings'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'companionId': widget.companionId,
          'patronId': widget.userId,
          'sessionType': _sessionType,
          'durationMinutes': _durationMinutes,
          'coinCost': _estimatedCost,
          'scheduledAt': _scheduledAt!.toIso8601String(),
          'idempotencyKey': '${widget.userId}-${widget.companionId}-${DateTime.now().millisecondsSinceEpoch}',
        }),
      );

      if (res.statusCode == 201 || res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final sessionId = (data['booking'] as Map<String, dynamic>)['sessionId'] as String?;
        if (mounted && sessionId != null) {
          context.pushReplacement('/sessions/$sessionId/timer',
              extra: {'userId': widget.userId, 'sessionType': _sessionType});
        }
      } else {
        setState(() => _error = 'Booking failed. Please try again.');
      }
    } catch (e) {
      setState(() => _error = 'Network error: $e');
    } finally {
      if (mounted) setState(() => _booking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text('Book a Session', style: TextStyle(color: Colors.white)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // ── Session type ──────────────────────────────────────────────────
          _Label('Session Type'),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: _sessionTypes.map((t) => ChoiceChip(
              label: Text(t),
              selected: _sessionType == t,
              onSelected: (_) => setState(() => _sessionType = t),
              selectedColor: const Color(0xFFE040FB),
              labelStyle: TextStyle(color: _sessionType == t ? Colors.white : Colors.grey),
            )).toList(),
          ),

          const SizedBox(height: 24),

          // ── Duration ──────────────────────────────────────────────────────
          _Label('Duration'),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: _durations.map((d) => ChoiceChip(
              label: Text('$d min'),
              selected: _durationMinutes == d,
              onSelected: (_) => setState(() => _durationMinutes = d),
              selectedColor: const Color(0xFFE040FB),
              labelStyle: TextStyle(color: _durationMinutes == d ? Colors.white : Colors.grey),
            )).toList(),
          ),

          const SizedBox(height: 24),

          // ── Schedule ──────────────────────────────────────────────────────
          _Label('Schedule'),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: _pickSchedule,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey[700]!),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.schedule, color: Colors.grey, size: 18),
                  const SizedBox(width: 12),
                  Text(
                    _scheduledAt == null
                        ? 'Choose date & time'
                        : '${_scheduledAt!.day}/${_scheduledAt!.month}/${_scheduledAt!.year}  '
                          '${_scheduledAt!.hour.toString().padLeft(2,'0')}:'
                          '${_scheduledAt!.minute.toString().padLeft(2,'0')}',
                    style: TextStyle(
                      color: _scheduledAt == null ? Colors.grey[600] : Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 32),

          // ── Cost summary ──────────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1A1A1A),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              children: [
                _CostRow('Session Type', _sessionType),
                _CostRow('Duration', '$_durationMinutes minutes'),
                const Divider(color: Colors.grey),
                _CostRow('Estimated Cost', '$_estimatedCost coins',
                    highlight: true),
              ],
            ),
          ),

          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.red)),
          ],

          const SizedBox(height: 24),

          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _booking ? null : _book,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFE040FB),
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: _booking
                  ? const SizedBox(height: 20, width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text('Book — $_estimatedCost coins',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }
}

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);
  @override
  Widget build(BuildContext context) => Text(text,
      style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w600));
}

class _CostRow extends StatelessWidget {
  final String label;
  final String value;
  final bool highlight;
  const _CostRow(this.label, this.value, {this.highlight = false});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
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
