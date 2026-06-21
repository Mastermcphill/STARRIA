import { BadRequestException } from '@nestjs/common';
import { validateUpload } from './upload-validation';

describe('validateUpload', () => {
  it('accepts a valid avatar', () => {
    expect(() =>
      validateUpload({ purpose: 'avatars', fileName: 'me.png', contentType: 'image/png' }),
    ).not.toThrow();
  });

  it('accepts a valid video', () => {
    expect(() =>
      validateUpload({ purpose: 'videos', fileName: 'clip.mp4', contentType: 'video/mp4' }),
    ).not.toThrow();
  });

  it('rejects a disallowed MIME type for the purpose', () => {
    expect(() =>
      validateUpload({ purpose: 'avatars', fileName: 'clip.mp4', contentType: 'video/mp4' }),
    ).toThrow(BadRequestException);
  });

  it('rejects MIME/extension mismatch (smuggling)', () => {
    expect(() =>
      validateUpload({ purpose: 'images', fileName: 'evil.mp4', contentType: 'image/png' }),
    ).toThrow(BadRequestException);
  });

  it('rejects a missing extension', () => {
    expect(() =>
      validateUpload({ purpose: 'images', fileName: 'noext', contentType: 'image/png' }),
    ).toThrow(BadRequestException);
  });

  it('rejects an oversized file', () => {
    expect(() =>
      validateUpload({
        purpose: 'avatars',
        fileName: 'big.png',
        contentType: 'image/png',
        size: 50 * 1024 * 1024,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects an unknown purpose', () => {
    expect(() =>
      validateUpload({ purpose: 'evil' as never, fileName: 'x.png', contentType: 'image/png' }),
    ).toThrow(BadRequestException);
  });

  it('is case-insensitive on content type and extension', () => {
    expect(() =>
      validateUpload({ purpose: 'avatars', fileName: 'ME.PNG', contentType: 'IMAGE/PNG' }),
    ).not.toThrow();
  });
});
