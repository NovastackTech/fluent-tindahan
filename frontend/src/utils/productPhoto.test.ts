import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_PRODUCT_PHOTO_BYTES,
  ProductPhotoError,
  resizeProductPhoto
} from './productPhoto';

describe('resizeProductPhoto', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unsupported image types and files larger than 10 MB', async () => {
    await expect(resizeProductPhoto(new File(['data'], 'photo.gif', { type: 'image/gif' })))
      .rejects.toMatchObject({ code: 'unsupported' } satisfies Partial<ProductPhotoError>);

    const oversized = new File(
      [new Uint8Array(MAX_PRODUCT_PHOTO_BYTES + 1)],
      'photo.png',
      { type: 'image/png' }
    );
    await expect(resizeProductPhoto(oversized))
      .rejects.toMatchObject({ code: 'too-large' } satisfies Partial<ProductPhotoError>);
  });

  it('resizes the longest edge to 800 pixels and encodes JPEG at 80 percent quality', async () => {
    const originalCreateElement = document.createElement.bind(document);
    const drawImage = vi.fn();
    const toBlob = vi.fn((callback: BlobCallback, type?: string, quality?: number) => {
      expect(type).toBe('image/jpeg');
      expect(quality).toBe(0.8);
      callback(new Blob(['jpeg'], { type: 'image/jpeg' }));
    });
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ fillStyle: '', fillRect: vi.fn(), drawImage }),
      toBlob
    } as unknown as HTMLCanvasElement;
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) =>
      tagName === 'canvas' ? canvas : originalCreateElement(tagName)
    );

    class TestImage {
      naturalWidth = 1600;
      naturalHeight = 800;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', TestImage);

    const result = await resizeProductPhoto(new File(['data'], 'photo.webp', { type: 'image/webp' }));

    expect(result.type).toBe('image/jpeg');
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(400);
    expect(drawImage).toHaveBeenCalledWith(expect.any(TestImage), 0, 0, 800, 400);
  });
});
