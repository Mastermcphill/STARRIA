import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import 'upload_repository.dart';

const _genres = ['COMEDY', 'AI_MOVIES', 'AI_SERIES', 'MUSIC', 'ANIMALS', 'ANIMATION', 'EDUCATION', 'LIFESTYLE'];

class UploadScreen extends ConsumerStatefulWidget {
  const UploadScreen({super.key});

  @override
  ConsumerState<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends ConsumerState<UploadScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _country = TextEditingController(text: 'NG');
  String _genre = 'COMEDY';
  bool _busy = false;
  String? _message;

  Future<void> _pickAndUpload() async {
    setState(() { _busy = true; _message = null; });
    try {
      // MVP: simulate a completed object-storage upload with a generated key.
      // Wire a real picker (image_picker / file_selector) + signed-URL upload later.
      final storageKey = 'uploads/${const Uuid().v4()}.mp4';
      final res = await ref.read(uploadRepositoryProvider).upload(
            title: _title.text.trim().isEmpty ? 'Untitled' : _title.text.trim(),
            description: _description.text.trim().isEmpty ? null : _description.text.trim(),
            genre: _genre,
            storageKey: storageKey,
            country: _country.text.trim().isEmpty ? null : _country.text.trim().toUpperCase(),
          );
      setState(() => _message = 'Published: ${res['id']} (${res['status']})');
    } catch (e) {
      setState(() => _message = 'Upload failed: $e');
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Upload')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(controller: _title, decoration: const InputDecoration(labelText: 'Title')),
            const SizedBox(height: 8),
            TextField(controller: _description, maxLines: 3, decoration: const InputDecoration(labelText: 'Description')),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _genre,
              decoration: const InputDecoration(labelText: 'Genre'),
              items: _genres.map((g) => DropdownMenuItem(value: g, child: Text(g))).toList(),
              onChanged: (v) => setState(() => _genre = v ?? 'COMEDY'),
            ),
            const SizedBox(height: 8),
            TextField(controller: _country, decoration: const InputDecoration(labelText: 'Country (ISO, e.g. NG)')),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _busy ? null : _pickAndUpload,
              icon: _busy ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.cloud_upload),
              label: Text(_busy ? 'Uploading…' : 'Pick video & publish'),
            ),
            if (_message != null) ...[
              const SizedBox(height: 16),
              Text(_message!, style: TextStyle(color: _message!.startsWith('Published') ? Colors.green : Colors.red)),
            ],
          ],
        ),
      ),
    );
  }
}
