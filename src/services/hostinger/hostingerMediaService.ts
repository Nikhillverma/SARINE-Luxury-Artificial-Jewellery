import { compressForUpload } from '../../utils/imageUpload';

const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? '/api' : 'https://lavender-goldfish-844589.hostingersite.com/api')
).replace(/\/+$/, '');

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

export interface HostingerMediaAsset {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
  url: string;
  duplicateCount?: number;
}

export class HostingerMediaService {
  async listImages(search = "", limit = 40, offset = 0, filters: { mimeType?: string; from?: string; to?: string; sort?: "newest" | "oldest" | "filename" } = {}): Promise<{ media: HostingerMediaAsset[]; total: number; limit: number; offset: number }> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset), sort: filters.sort || "newest" });
    if (search.trim()) params.set("search", search.trim());
    if (filters.mimeType) params.set("mimeType", filters.mimeType);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    const response = await fetch(`${API_BASE}/admin/media?${params.toString()}`, {
      credentials: "include",
      headers: { Accept: "application/json" }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `Media library could not be loaded (${response.status}).`);
    const result = data as { media?: HostingerMediaAsset[]; total?: number; limit?: number; offset?: number };
    return {
      media: (result.media || []).map(asset => ({ ...asset, url: `${API_BASE}${asset.url.startsWith("/") ? asset.url : "/" + asset.url}` })),
      total: Number(result.total) || 0,
      limit: Number(result.limit) || limit,
      offset: Number(result.offset) || offset
    };
  }

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
