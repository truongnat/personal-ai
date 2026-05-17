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
    const keys = await this.client.keys(pattern)
    if (keys.length > 0) {
      await this.client.del(...keys)
    }
  }
}
