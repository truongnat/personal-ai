import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name)
  private client: Redis

  constructor(private config: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.config.get<string>('REDIS_HOST'),
      port: this.config.get<number>('REDIS_PORT'),
      password: this.config.get<string>('REDIS_PASSWORD'),
    })
    this.client.on('connect', () => this.logger.log('Redis connected'))
    this.client.on('error', (err) => this.logger.error('Redis error', err))
  }

  async onModuleDestroy() {
    await this.client.quit()
  }

  async get<T>(key: string): Promise<T | null> {
    const val = await this.client.get(key)
    if (!val) return null
    return JSON.parse(val)
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  }

  async del(key: string): Promise<void> {
    await this.client.del(key)
  }

  async delByPattern(pattern: string): Promise<void> {
    const pipeline = this.client.pipeline()
    let cursor = '0'
    const SCAN_COUNT = 100 // Iterate in batches to avoid blocking

    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', SCAN_COUNT)
      cursor = nextCursor

      // Queue deletions for this batch
      for (const key of keys) {
        pipeline.del(key)
      }
    } while (cursor !== '0')

    // Execute all deletions
    await pipeline.exec()
  }
}
