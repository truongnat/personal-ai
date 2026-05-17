import { Controller, Get, HttpCode } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'

@Controller()
export class AppController {
  @Get('/health')
  @HttpCode(200)
  @SkipThrottle() // Health checks should bypass rate limiting
  health() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }
  }
}
