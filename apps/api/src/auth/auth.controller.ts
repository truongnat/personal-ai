import { Controller, Post, Delete, Get, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiParam } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { MasterGuard } from './master.guard'
import { GenerateKeyDto } from './dto/generate-key.dto'

@Controller('auth')
@UseGuards(MasterGuard)
@ApiTags('auth')
@ApiHeader({
  name: 'x-master-password',
  description: 'Master password for authentication',
  required: true,
})
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('generate-key')
  @ApiOperation({
    summary: 'Generate new API key',
    description: 'Creates a new API key for accessing the KB and Skill APIs',
  })
  @ApiResponse({
    status: 201,
    description: 'API key generated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        key: { type: 'string', example: 'kb_live_...' },
        label: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  generateKey(@Body() dto: GenerateKeyDto) {
    return this.authService.generateKey(dto.label, dto.expiresIn)
  }

  @Delete('revoke-key/:id')
  @ApiOperation({
    summary: 'Revoke API key',
    description: 'Deactivates an API key, preventing further use',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'API key revoked successfully' })
  revokeKey(@Param('id') id: string) {
    return this.authService.revokeKey(id)
  }

  @Get('keys')
  @ApiOperation({
    summary: 'List all API keys',
    description: 'Returns all active and inactive API keys (masked)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of API keys',
    schema: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              label: { type: 'string' },
              key_masked: { type: 'string', example: 'kb_live_xxxx...xxxx' },
              active: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
              use_count: { type: 'number' },
            },
          },
        },
      },
    },
  })
  listKeys() {
    return this.authService.listKeys().then((keys) => ({ keys }))
  }
}
