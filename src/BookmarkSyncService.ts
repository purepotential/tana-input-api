import winston from 'winston';
import { HoarderClient, HoarderBookmark } from './HoarderClient.js';
import { TanaAPIHelper } from './TanaAPIClient.js';
import { APINode, APIPlainNode, APIField } from './types/types.js';
import { RedisCache } from './RedisCache.js';
import { CacheBackupService } from './CacheBackupService.js';

export class BookmarkSyncService {
  private logger: winston.Logger;
  private cache: RedisCache;
  private backupService: CacheBackupService;

  constructor(
    private hoarderClient: HoarderClient,
    private tanaClient: TanaAPIHelper,
    private options: {
      redisUrl?: string;
      batchSize?: number;
      backupDir?: string;
      backupIntervalMs?: number;
    } = {}
  ) {
    this.cache = new RedisCache(options.redisUrl);
    this.backupService = new CacheBackupService(this.cache, {
      backupDir: options.backupDir,
      backupIntervalMs: options.backupIntervalMs || 5 * 60 * 1000, // Default to 5 minutes
    });

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'sync-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'sync.log' }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });
  }

  private normalizeUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      
      // Remove common tracking parameters
      const paramsToRemove = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_term',
        'utm_content',
        'source',
        'ref',
        'referral',
        'fbclid',
        'gclid',
        '_ga',
        'mc_cid',
        'mc_eid',
        'yclid',
        '_hsenc',
        '_hsmi',
        'mkt_tok',
        'campaign',
        'medium',
        'term',
        'content',
      ];

      // Create a new URLSearchParams object
      const params = parsedUrl.searchParams;
      
      // Remove tracking parameters
      paramsToRemove.forEach(param => {
        params.delete(param);
      });

      // Sort remaining parameters alphabetically for consistency
      const sortedParams = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b));

      // Clear all params
      parsedUrl.search = '';

      // Add back sorted non-tracking params
      if (sortedParams.length > 0) {
        parsedUrl.search = '?' + new URLSearchParams(sortedParams).toString();
      }

      // Remove hash/fragment
      parsedUrl.hash = '';

      // Remove 'www.' from hostname
      parsedUrl.hostname = parsedUrl.hostname.replace(/^www\./, '');

      // Ensure protocol is always https if available
      parsedUrl.protocol = 'https:';

      // Remove trailing slash
      let normalizedUrl = parsedUrl.toString();
      if (normalizedUrl.endsWith('/')) {
        normalizedUrl = normalizedUrl.slice(0, -1);
      }

      return normalizedUrl;
    } catch (error) {
      this.logger.warn(`Failed to normalize URL: ${url}`, { error });
      return url;
    }
  }

  async initialize(): Promise<void> {
    await this.cache.connect();
    await this.backupService.restore(); // Restore from backup if available
    await this.backupService.startBackupInterval();
  }

  async cleanup(): Promise<void> {
    await this.backupService.backup(); // Backup before shutting down
    await this.backupService.stopBackupInterval();
    await this.cache.disconnect();
  }

  private mapBookmarkToTanaNode(bookmark: HoarderBookmark): APIPlainNode {
    const aiTags = bookmark.tags
      .filter(tag => tag.attachedBy === 'ai')
      .map(tag => tag.name)
      .join(', ');

    const fields: APIField[] = [
      {
        type: 'field',
        attributeId: '1IJSCbcJ-4x6',
        children: [{ name: bookmark.id }],
      },
      {
        type: 'field',
        attributeId: 'TAuNkyKd4gv4',
        children: [{ name: bookmark.content.title || bookmark.title || 'Untitled Bookmark' }],
      },
      {
        type: 'field',
        attributeId: 'kmEPGZ9RM0hA',
        children: [{ name: bookmark.content.description || bookmark.summary || '' }],
      },
      {
        type: 'field',
        attributeId: 'aosg60mUhj0s',
        children: [{ name: aiTags }],
      },
      {
        type: 'field',
        attributeId: '1Q0LdvnE7q7a',
        children: [{ dataType: 'url', name: bookmark.content.url || '' }],
      },
      {
        type: 'field',
        attributeId: 'zENeYHbvA6f4',
        children: [{ name: bookmark.content.fullPageArchiveAssetId || '' }],
      },
      {
        type: 'field',
        attributeId: 'jO0i0yhryT7J',
        children: [{ 
          dataType: 'url', 
          name: bookmark.content.fullPageArchiveAssetId 
            ? this.hoarderClient.getArchiveUrl(bookmark.content.fullPageArchiveAssetId)
            : '' 
        }],
      },
      // Created date as a separate field
      {
        type: 'field',
        attributeId: 'hrTDjcwTMcyo',
        children: [{ name: bookmark.createdAt }],
      },
    ];

    return {
      name: bookmark.content.title || bookmark.title || 'Untitled Bookmark',
      supertags: [{ id: 'Jv6WSsH6CO7u' }], // Article supertag
      children: fields,
    };
  }

  private async isBookmarkSynced(bookmark: HoarderBookmark): Promise<boolean> {
    // Check if this specific bookmark ID has been synced
    const idCacheKey = `bookmark_${bookmark.id}`;
    if (await this.cache.has(idCacheKey)) {
      this.logger.debug(`Bookmark ${bookmark.id} already synced (ID match), skipping`);
      return true;
    }

    // Check if any bookmark with this normalized URL has been synced
    const normalizedUrl = this.normalizeUrl(bookmark.content.url);
    const urlCacheKey = `url_${normalizedUrl}`;
    if (await this.cache.has(urlCacheKey)) {
      this.logger.debug(`Bookmark ${bookmark.id} already synced (URL match: ${normalizedUrl}), skipping`);
      return true;
    }

    return false;
  }

  private async markBookmarkSynced(bookmark: HoarderBookmark): Promise<void> {
    // Store both ID and normalized URL-based cache entries
    const idCacheKey = `bookmark_${bookmark.id}`;
    const normalizedUrl = this.normalizeUrl(bookmark.content.url);
    const urlCacheKey = `url_${normalizedUrl}`;
    
    await Promise.all([
      this.cache.set(idCacheKey, true),
      this.cache.set(urlCacheKey, true)
    ]);
  }

  private async syncBookmark(bookmark: HoarderBookmark): Promise<void> {
    try {
      // Skip if already synced (by ID or URL)
      if (await this.isBookmarkSynced(bookmark)) {
        return;
      }

      const node = this.mapBookmarkToTanaNode(bookmark);
      await this.tanaClient.createNode(node);
      
      await this.markBookmarkSynced(bookmark);
      this.logger.info(`Successfully synced bookmark ${bookmark.id}`);
    } catch (error) {
      this.logger.error(`Failed to sync bookmark ${bookmark.id}`, { error });
      throw error;
    }
  }

  async performInitialSync(): Promise<void> {
    this.logger.info('Starting initial sync');
    let cursor: string | undefined;
    const batchSize = this.options.batchSize || 50;
    
    try {
      do {
        const response = await this.hoarderClient.getAllBookmarks(cursor, batchSize);
        
        for (const bookmark of response.bookmarks) {
          await this.syncBookmark(bookmark);
        }
        
        cursor = response.nextCursor;
        this.logger.info(`Processed batch of ${response.bookmarks.length} bookmarks`);
        
        if (cursor) {
          await this.cache.set('last_cursor', cursor);
        }

        // Backup cache after each batch
        await this.backupService.backup();
        this.logger.debug('Cache backed up after batch sync');
        
      } while (cursor);
      
      this.logger.info('Initial sync completed successfully');
    } catch (error) {
      this.logger.error('Initial sync failed', { error });
      throw error;
    }
  }

  async performIncrementalSync(): Promise<void> {
    const lastCursor = await this.cache.get<string>('last_cursor');
    if (!lastCursor) {
      this.logger.warn('No last cursor found, performing initial sync');
      return this.performInitialSync();
    }

    try {
      this.logger.info('Starting incremental sync');
      const response = await this.hoarderClient.getAllBookmarks(lastCursor);
      
      for (const bookmark of response.bookmarks) {
        await this.syncBookmark(bookmark);
      }
      
      if (response.nextCursor) {
        await this.cache.set('last_cursor', response.nextCursor);
      }

      // Backup cache after incremental sync
      await this.backupService.backup();
      this.logger.debug('Cache backed up after incremental sync');
      
      this.logger.info('Incremental sync completed successfully');
    } catch (error) {
      this.logger.error('Incremental sync failed', { error });
      throw error;
    }
  }

  async performTestSync(limit: number = 5): Promise<void> {
    this.logger.info(`Starting test sync with ${limit} bookmarks`);
    
    try {
      const response = await this.hoarderClient.getAllBookmarks(undefined, limit);
      
      this.logger.info(`Retrieved ${response.bookmarks.length} bookmarks for testing`);
      
      for (const bookmark of response.bookmarks) {
        try {
          const node = this.mapBookmarkToTanaNode(bookmark);
          await this.tanaClient.createNode(node);
          this.logger.info(`Successfully synced test bookmark ${bookmark.id} with title "${bookmark.content.title || bookmark.title || 'Untitled'}"`);
        } catch (error) {
          this.logger.error(`Failed to sync test bookmark ${bookmark.id}`, { error, bookmark });
        }
      }

      // Backup cache after test sync
      await this.backupService.backup();
      this.logger.debug('Cache backed up after test sync');
      
      this.logger.info('Test sync completed');
    } catch (error) {
      this.logger.error('Test sync failed', { error });
      throw error;
    }
  }
} 