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

let syncService: BookmarkSyncService;

async function main() {
  // Initialize clients
  const hoarderClient = new HoarderClient(HOARDER_BASE_URL as string, HOARDER_TOKEN as string);
  const tanaClient = new TanaAPIHelper(TANA_TOKEN as string);

  // Initialize sync service with Redis and backup
  syncService = new BookmarkSyncService(hoarderClient, tanaClient, {
    redisUrl: REDIS_URL,
    batchSize: 50, // Process 50 bookmarks at a time
    backupDir: path.join(process.cwd(), 'backup'),
    backupIntervalMs: 5 * 60 * 1000, // Backup every 5 minutes
  });

  try {
    // Connect to Redis and restore from backup if available
    await syncService.initialize();

    // Perform initial sync
    await syncService.performInitialSync();

    // Set up incremental sync interval (every 5 minutes)
    setInterval(async () => {
      try {
        await syncService.performIncrementalSync();
      } catch (error) {
        console.error('Incremental sync failed:', error);
      }
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('Initial sync failed:', error);
    await cleanup();
    process.exit(1);
  }
}

async function cleanup() {
  if (syncService) {
    try {
      await Promise.race([
        syncService.cleanup(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Cleanup timeout after 10 seconds')), 10000)
        )
      ]);
      return true;
    } catch (error) {
      console.error('Cleanup failed:', error);
      return false;
    }
  }
  return true;
}

// Handle process termination
async function shutdownGracefully(signal: string) {
  console.log(`Received ${signal}. Cleaning up...`);
  try {
    const cleanupSuccessful = await cleanup();
    process.exit(cleanupSuccessful ? 0 : 1);
  } catch (error) {
    console.error('Fatal error during cleanup:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdownGracefully('SIGINT'));
process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));

main(); 