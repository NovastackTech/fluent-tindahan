export const MAX_PRODUCT_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PRODUCT_PHOTO_DIMENSION = 800;
export const PRODUCT_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ProductPhotoErrorCode = 'unsupported' | 'too-large' | 'unreadable';

export class ProductPhotoError extends Error {
  readonly code: ProductPhotoErrorCode;

  constructor(code: ProductPhotoErrorCode) {
    super(code);
    this.code = code;
  }
}

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new ProductPhotoError('unreadable'));
  image.src = url;
});

export async function resizeProductPhoto(file: File): Promise<Blob> {
  if (!PRODUCT_PHOTO_TYPES.includes(file.type as typeof PRODUCT_PHOTO_TYPES[number])) {
    throw new ProductPhotoError('unsupported');
  }
  if (file.size > MAX_PRODUCT_PHOTO_BYTES) {
    throw new ProductPhotoError('too-large');
  }

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new ProductPhotoError('unreadable');
    }

    const scale = Math.min(1, MAX_PRODUCT_PHOTO_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new ProductPhotoError('unreadable');
    }

    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    if (!blob) {
      throw new ProductPhotoError('unreadable');
    }
    return blob;
  } catch (error) {
    if (error instanceof ProductPhotoError) throw error;
    throw new ProductPhotoError('unreadable');
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
