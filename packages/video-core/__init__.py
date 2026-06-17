"""video-core — reusable video infrastructure extracted from Vidzi.

Provides:
  - Storage provider abstraction (local placeholder, S3/R2)
  - Presigned upload lifecycle (URL issuance, completion, scan callbacks)
  - Video session token generation (LiveKit, dev placeholder)
  - Interface stubs for transcoding, HLS, thumbnails, and metadata extraction
"""
__version__ = "0.1.0"
