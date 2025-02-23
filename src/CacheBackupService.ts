import fs from 'fs/promises';
import path from 'path';
import { RedisCache } from './RedisCache.js';

export class CacheBackupService {
  private backupPath: string;
  private backupInterval?: NodeJS.Timeout;

  constructor(
    private cache: RedisCache,
    private options: {
      backupDir?: string;
      backupIntervalMs?: number;
    } = {}
  ) {
    this.backupPath = path.join(this.options.backupDir || '.', 'cache-backup.json');
  }

  async startBackupInterval(): Promise<void> {
    if (this.options.backupIntervalMs) {
      this.backupInterval = setInterval(
        () => this.backup(),
        this.options.backupIntervalMs
      );
    }
  }

  async stopBackupInterval(): Promise<void> {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }
  }

  async backup(): Promise<void> {
    try {
      // Get all keys
      const keys = await this.cache.getAllKeys();
      const backup: Record<string, any> = {};

      // Get all values
      for (const key of keys) {
        backup[key] = await this.cache.get(key);
      }

      // Ensure backup directory exists
      await fs.mkdir(path.dirname(this.backupPath), { recursive: true });

      // Write to file
      await fs.writeFile(
        this.backupPath,
        JSON.stringify(backup, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to backup cache:', error);
    }
  }

  async restore(): Promise<void> {
    try {
      // Check if backup file exists
      try {
        await fs.access(this.backupPath);
      } catch {
        console.log('No backup file found, skipping restore');
        return;
      }

      // Read backup file
      const data = await fs.readFile(this.backupPath, 'utf-8');
      const backup = JSON.parse(data);

      // Restore all key-value pairs
      for (const [key, value] of Object.entries(backup)) {
        await this.cache.set(key, value);
      }

      console.log('Cache restored from backup');
    } catch (error) {
      console.error('Failed to restore cache from backup:', error);
    }
  }
} 