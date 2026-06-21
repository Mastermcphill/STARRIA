import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../media/media_repository.dart';
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
  double? _uploadProgress;
  String? _message;

  Future<void> _pickAndUpload() async {
    setState(() {
      _busy = true;
      _message = null;
      _uploadProgress = null;
    });

    try {
      // Step 1: Pick video file and upload to R2 via presigned URL.
      final media = await ref.read(mediaRepositoryProvider).pickAndUpload(
            purpose: 'videos',
            fileType: FileType.video,
            onProgress: (p) => setState(() => _uploadProgress = p),
          );

      setState(() => _uploadProgress = 1.0);

      // Step 2: Register the video with the API using the R2 storage key.
      final res = await ref.read(uploadRepositoryProvider).upload(
            title: _title.text.trim().isEmpty ? 'Untitled' : _title.text.trim(),
            description: _description.text.trim().isEmpty ? null : _description.text.trim(),
            genre: _genre,
            storageKey: media.key,
            country: _country.text.trim().isEmpty ? null : _country.text.trim().toUpperCase(),
          );

      setState(() => _message = 'Published: ${res['id']} (${res['status']})');
    } on Exception catch (e) {
      final msg = e.toString();
      if (msg.contains('No file selected')) {
        setState(() => _message = null); // user cancelled — silent
      } else {
        setState(() => _message = 'Upload failed: $e');
      }
    } finally {
      setState(() {
        _busy = false;
        _uploadProgress = null;
      });
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
            TextField(
              controller: _description,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Description'),
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _genre,
              decoration: const InputDecoration(labelText: 'Genre'),
              items: _genres.map((g) => DropdownMenuItem(value: g, child: Text(g))).toList(),
              onChanged: (v) => setState(() => _genre = v ?? 'COMEDY'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _country,
              decoration: const InputDecoration(labelText: 'Country (ISO, e.g. NG)'),
            ),
            const SizedBox(height: 24),
            if (_uploadProgress != null) ...[
              LinearProgressIndicator(value: _uploadProgress),
              const SizedBox(height: 8),
              Text(
                _uploadProgress! < 1.0
                    ? 'Uploading… ${(_uploadProgress! * 100).toStringAsFixed(0)}%'
                    : 'Processing…',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 8),
            ],
            FilledButton.icon(
              onPressed: _busy ? null : _pickAndUpload,
              icon: _busy
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.cloud_upload),
              label: Text(_busy ? 'Uploading…' : 'Pick video & publish'),
            ),
            if (_message != null) ...[
              const SizedBox(height: 16),
              Text(
                _message!,
                style: TextStyle(
                  color: _message!.startsWith('Published') ? Colors.green : Colors.red,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
