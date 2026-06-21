import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../core/config/app_config.dart';

const _states = ['ONLINE', 'AWAY', 'BUSY', 'OFFLINE'];

const _stateIcons = {
  'ONLINE':  (Icons.circle, Colors.green),
  'AWAY':    (Icons.access_time, Colors.orange),
  'BUSY':    (Icons.do_not_disturb, Colors.red),
  'OFFLINE': (Icons.circle_outlined, Colors.grey),
};

class PresenceSettingsScreen extends StatefulWidget {
  final String userId;
  const PresenceSettingsScreen({super.key, required this.userId});

  @override
  State<PresenceSettingsScreen> createState() => _PresenceSettingsScreenState();
}

class _PresenceSettingsScreenState extends State<PresenceSettingsScreen> {
  String _selected = 'ONLINE';
  bool _saving = false;

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final res = await http.patch(
        Uri.parse('${AppConfig.apiBase}/presence'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'userId': widget.userId, 'state': _selected}),
      );
      if (res.statusCode == 200 && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Presence updated')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Presence Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Set your status',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ..._states.map((state) {
            final (icon, color) = _stateIcons[state]!;
            return RadioListTile<String>(
              value: state,
              groupValue: _selected,
              onChanged: (v) => setState(() => _selected = v!),
              secondary: Icon(icon, color: color),
              title: Text(state[0] + state.substring(1).toLowerCase()),
            );
          }),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save Status'),
          ),
        ],
      ),
    );
  }
}
