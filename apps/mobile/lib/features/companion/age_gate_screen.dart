import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import '../../core/config/app_config.dart';

/// AgeGateScreen — users MUST explicitly enter "STARRIA Companion".
/// This surface is completely separate from standard STARRIA discovery.
/// Never accessible from the main discovery feed.
class AgeGateScreen extends StatefulWidget {
  final String userId;
  final String destination; // route to push after gate passes

  const AgeGateScreen({
    super.key,
    required this.userId,
    required this.destination,
  });

  @override
  State<AgeGateScreen> createState() => _AgeGateScreenState();
}

class _AgeGateScreenState extends State<AgeGateScreen> {
  bool _dobConfirmed      = false;
  bool _contentWarning    = false;
  bool _companionConsent  = false;
  bool _safeModeAck       = false;
  bool _submitting        = false;
  String? _error;

  DateTime? _dob;

  Future<void> _submit() async {
    if (!_dobConfirmed || !_contentWarning || !_companionConsent) {
      setState(() => _error = 'Please confirm all requirements.');
      return;
    }
    if (_dob == null) {
      setState(() => _error = 'Please enter your date of birth.');
      return;
    }

    setState(() { _submitting = true; _error = null; });

    try {
      // 1. Submit age verification
      final verifyRes = await http.post(
        Uri.parse('${AppConfig.apiBase}/age-gate/verify'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'userId': widget.userId,
          'level': '18+',
          'method': 'SELF_DECLARE',
          'selfDeclaredDob': '${_dob!.year.toString().padLeft(4, '0')}'
              '-${_dob!.month.toString().padLeft(2, '0')}'
              '-${_dob!.day.toString().padLeft(2, '0')}',
        }),
      );

      final verifyBody = jsonDecode(verifyRes.body) as Map<String, dynamic>;
      if (verifyBody['status'] != 'PASSED') {
        setState(() { _error = 'Age verification failed. You must be 18+ to continue.'; _submitting = false; });
        return;
      }

      // 2. Record companion discovery consent
      await http.post(
        Uri.parse('${AppConfig.apiBase}/age-gate/consent'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'userId': widget.userId,
          'consentType': 'COMPANION_DISCOVERY',
          'granted': true,
        }),
      );

      if (mounted) context.go(widget.destination);
    } catch (e) {
      setState(() { _error = 'Something went wrong. Please try again.'; _submitting = false; });
    }
  }

  Future<void> _pickDob() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime(2000),
      firstDate: DateTime(1920),
      lastDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
      helpText: 'Select your date of birth',
    );
    if (date != null) setState(() => _dob = date);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 32),
              // ── Header ───────────────────────────────────────────────────────
              Text(
                'STARRIA Companion',
                style: theme.textTheme.headlineMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'This is a separate experience from standard STARRIA. '
                'Companion sessions are 1-on-1 or small group interactions '
                'with verified creators.',
                style: theme.textTheme.bodyMedium?.copyWith(color: Colors.grey[400]),
              ),

              const SizedBox(height: 32),

              // ── Content warning ──────────────────────────────────────────────
              _WarningCard(
                icon: Icons.warning_amber_rounded,
                title: 'Content Warning',
                body: 'Companion sessions may include mature themes, '
                    'suggestive content, strong language, and intimate conversation. '
                    'You must be 18 or older to enter.',
              ),

              const SizedBox(height: 24),

              // ── DOB picker ───────────────────────────────────────────────────
              Text('Date of Birth', style: theme.textTheme.titleSmall?.copyWith(color: Colors.white)),
              const SizedBox(height: 8),
              GestureDetector(
                onTap: _pickDob,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey[700]!),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.calendar_today, color: Colors.grey[400], size: 18),
                      const SizedBox(width: 12),
                      Text(
                        _dob == null
                            ? 'Select your date of birth'
                            : '${_dob!.day}/${_dob!.month}/${_dob!.year}',
                        style: TextStyle(color: _dob == null ? Colors.grey[600] : Colors.white),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // ── Checkboxes ───────────────────────────────────────────────────
              _ConsentCheck(
                value: _dobConfirmed,
                onChanged: (v) => setState(() => _dobConfirmed = v!),
                label: 'I confirm I am 18 years of age or older.',
                textColor: Colors.white,
              ),
              _ConsentCheck(
                value: _contentWarning,
                onChanged: (v) => setState(() => _contentWarning = v!),
                label: 'I understand this section contains mature content.',
                textColor: Colors.white,
              ),
              _ConsentCheck(
                value: _companionConsent,
                onChanged: (v) => setState(() => _companionConsent = v!),
                label: 'I consent to entering STARRIA Companion.',
                textColor: Colors.white,
              ),
              _ConsentCheck(
                value: _safeModeAck,
                onChanged: (v) => setState(() => _safeModeAck = v!),
                label: 'I know I can enable Safe Mode in settings at any time.',
                textColor: Colors.grey[400]!,
              ),

              const SizedBox(height: 8),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(_error!, style: const TextStyle(color: Colors.red)),
                ),

              const SizedBox(height: 16),

              // ── CTA ──────────────────────────────────────────────────────────
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _submitting ? null : _submit,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFE040FB),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: _submitting
                      ? const SizedBox(
                          height: 20, width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Enter STARRIA Companion',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () => context.pop(),
                  child: Text('Go Back', style: TextStyle(color: Colors.grey[500])),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _WarningCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String body;
  const _WarningCard({required this.icon, required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.amber.withOpacity(0.1),
        border: Border.all(color: Colors.amber.withOpacity(0.4)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: Colors.amber, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text(body, style: TextStyle(color: Colors.grey[400], fontSize: 13)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ConsentCheck extends StatelessWidget {
  final bool value;
  final ValueChanged<bool?> onChanged;
  final String label;
  final Color textColor;
  const _ConsentCheck({
    required this.value,
    required this.onChanged,
    required this.label,
    required this.textColor,
  });

  @override
  Widget build(BuildContext context) {
    return CheckboxListTile(
      value: value,
      onChanged: onChanged,
      title: Text(label, style: TextStyle(color: textColor, fontSize: 14)),
      controlAffinity: ListTileControlAffinity.leading,
      contentPadding: EdgeInsets.zero,
      activeColor: const Color(0xFFE040FB),
    );
  }
}
