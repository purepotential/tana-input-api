import { createClient } from 'redis';

export class RedisCache {
  private client;

  constructor(url: string = 'redis://localhost:6379') {
    this.client = createClient({
      url,
    });

    this.client.on('error', err => console.error('Redis Client Error', err));
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.client.get(key);
    if (!value) return undefined;
    return JSON.parse(value) as T;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serializedValue = JSON.stringify(value);
    if (ttl) {
      await this.client.setEx(key, ttl, serializedValue);
    } else {
      await this.client.set(key, serializedValue);
    }
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async getAllKeys(): Promise<string[]> {
    return this.client.keys('*');
  }
} 