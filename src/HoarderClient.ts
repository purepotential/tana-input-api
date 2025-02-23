import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';

export const HoarderBookmarkSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  modifiedAt: z.string(),
  title: z.string().nullable(),
  archived: z.boolean(),
  favourited: z.boolean(),
  taggingStatus: z.enum(['success', 'failure', 'pending']),
  note: z.string().nullable(),
  summary: z.string().nullable(),
  tags: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      attachedBy: z.enum(['ai', 'human']),
    })
  ),
  content: z.object({
    type: z.literal('link'),
    url: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    imageUrl: z.string().nullable().optional(),
    imageAssetId: z.string().optional(),
    screenshotAssetId: z.string().optional(),
    fullPageArchiveAssetId: z.string().optional(),
    favicon: z.string().nullable().optional(),
    htmlContent: z.string().nullable().optional(),
    crawledAt: z.string().optional(),
  }),
  assets: z.array(
    z.object({
      id: z.string(),
      assetType: z.enum([
        'screenshot',
        'assetScreenshot',
        'bannerImage',
        'fullPageArchive',
        'video',
        'bookmarkAsset',
        'precrawledArchive',
        'unknown',
      ]),
    })
  ),
});

export type HoarderBookmark = z.infer<typeof HoarderBookmarkSchema>;

export const HoarderResponseSchema = z.object({
  bookmarks: z.array(HoarderBookmarkSchema),
  nextCursor: z.string().optional(),
});

export type HoarderResponse = z.infer<typeof HoarderResponseSchema>;

export class HoarderClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseURL: string, token: string) {
    this.baseUrl = baseURL.replace(/\/$/, '');
    this.client = axios.create({
      baseURL: `${this.baseUrl}/api/v1`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async getAllBookmarks(cursor?: string, limit: number = 100): Promise<HoarderResponse> {
    const params = new URLSearchParams();
    if (cursor) {
      params.append('cursor', cursor);
    }
    params.append('limit', limit.toString());

    const response = await this.client.get(`/bookmarks?${params.toString()}`);
    return HoarderResponseSchema.parse(response.data);
  }

  getArchiveUrl(archiveId: string): string {
    return `${this.baseUrl}/archive/${archiveId}`;
  }
} 