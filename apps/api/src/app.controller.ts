import { Controller, Get, HttpCode } from '@nestjs/common'
import { ApiOperation, ApiResponse } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'

@Controller()
export class AppController {
  @Get('/health')
  @HttpCode(200)
  @SkipThrottle() // Health checks should bypass rate limiting
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns service health status with uptime information',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        uptime: { type: 'number', example: 1.966, description: 'Uptime in seconds' },
        timestamp: { type: 'string', example: '2026-05-17T16:24:14.768Z' },
      },
    },
  })
  health() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }
  }
}
