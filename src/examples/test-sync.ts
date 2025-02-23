import dotenv from 'dotenv';
import path from 'path';
import { HoarderClient } from '../HoarderClient.js';
import { TanaAPIHelper } from '../TanaAPIClient.js';
import { BookmarkSyncService } from '../BookmarkSyncService.js';

// Load environment variables
dotenv.config();

const TANA_TOKEN = process.env.TANA_TOKEN;
const HOARDER_TOKEN = process.env.HOARDER_TOKEN;
const HOARDER_BASE_URL = process.env.HOARDER_BASE_URL;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

if (!TANA_TOKEN || !HOARDER_TOKEN || !HOARDER_BASE_URL) {
  console.error('Missing required environment variables');
  process.exit(1);
}

async function main() {
  // Initialize clients
  const hoarderClient = new HoarderClient(HOARDER_BASE_URL as string, HOARDER_TOKEN as string);
  const tanaClient = new TanaAPIHelper(TANA_TOKEN as string);

  // Initialize sync service with Redis and backup
  const syncService = new BookmarkSyncService(hoarderClient, tanaClient, {
    redisUrl: REDIS_URL,
    backupDir: path.join(process.cwd(), 'backup'),
    backupIntervalMs: 5 * 60 * 1000, // Not really needed for test but keeping consistent
  });

  try {
    // Connect to Redis and restore from backup if available
    await syncService.initialize();

    // Test sync with 5 bookmarks
    await syncService.performTestSync(5);
  } catch (error) {
    console.error('Test sync failed:', error);
    process.exit(1);
  } finally {
    // Always disconnect from Redis and backup cache
    await syncService.cleanup();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Cleaning up...');
  process.exit();
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Cleaning up...');
  process.exit();
});

main(); 