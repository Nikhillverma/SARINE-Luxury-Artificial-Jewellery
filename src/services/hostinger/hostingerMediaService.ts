import { compressForUpload } from '../../utils/imageUpload';

const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? '/api' : 'https://lavender-goldfish-844589.hostingersite.com/api')
).replace(/\\/+$/, '');

interface UploadResponse {
  success: boolean;
  media: {
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    url: string;
  };
}

export class HostingerMediaService {
  async uploadImage(file: File): Promise<string> {
    const { base64, mimeType, fileName } = await compressForUpload(file);
    const response = await fetch(`${API_BASE}/admin/media`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fileName, mimeType, base64 })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : `Image upload failed (${response.status}).`
      );
    }

    const result = data as UploadResponse;
    if (!result.media?.id) throw new Error('The server did not confirm the image upload.');
    return `${API_BASE}/media/${encodeURIComponent(result.media.id)}`;
  }
}
