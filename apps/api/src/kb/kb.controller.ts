import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiQuery, ApiParam } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { KbService } from './kb.service'
import { ApiKeyGuard } from '../auth/api-key.guard'
import { PushKbDto } from './dto/push-kb.dto'
import { UpdateKbDto } from './dto/update-kb.dto'
import { SearchKbDto } from './dto/search-kb.dto'
import { SuggestTagsDto, SuggestTagsResponseDto } from './dto/suggest-tags.dto'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

@Controller('kb')
@UseGuards(ApiKeyGuard)
@ApiTags('kb')
@ApiHeader({
  name: 'x-api-key',
  description: 'API key for authentication',
  required: true,
})
export class KbController {
  constructor(private kbService: KbService) {}

  @Post('push')
  @ApiOperation({
    summary: 'Push solution to knowledge base',
    description: 'Creates a new solution and indexes it for search',
  })
  @ApiResponse({
    status: 201,
    description: 'Solution pushed successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        message: { type: 'string', example: 'Pushed successfully' },
        related_found: { type: 'number', description: 'Number of related solutions' },
      },
    },
  })
  push(@Body() dto: PushKbDto) {
    return this.kbService.push(dto)
  }

  @Throttle({ short: { limit: 2, ttl: 1000 } })
  @Get('search')
  @ApiOperation({
    summary: 'Search knowledge base',
    description: 'Full-text search with caching (2 req/sec limit)',
  })
  @ApiQuery({ name: 'q', type: 'string', description: 'Search query (required)' })
  @ApiQuery({ name: 'limit', type: 'number', required: false, example: 5, minimum: 1, maximum: 100 })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    schema: {
      type: 'object',
      properties: {
        results: { type: 'array' },
        total: { type: 'number' },
        cached: { type: 'boolean' },
      },
    },
  })
  async search(@Query('q') q: string, @Query('limit') limit?: string) {
    // Validate query parameter
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      throw new BadRequestException('Query parameter "q" is required and must be a non-empty string')
    }

    const limitNum = limit ? parseInt(limit) : 5
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Limit must be between 1 and 100')
    }

    return this.kbService.search(q, limitNum)
  }

  @Post('suggest-tags')
  @ApiOperation({
    summary: 'Suggest tags for solution content',
    description: 'Analyzes solution content and suggests relevant tags based on KB graph patterns and search similarity',
  })
  @ApiResponse({
    status: 200,
    description: 'Suggested tags with confidence scores',
    type: SuggestTagsResponseDto,
  })
  async suggestTags(@Body() dto: SuggestTagsDto): Promise<SuggestTagsResponseDto> {
    const suggestedTags = await this.kbService.suggestTags(dto.content, dto.project)

    // Generate brief topic summary from top tags
    const topicSummary = suggestedTags
      .slice(0, 3)
      .map((t) => t.tag)
      .join(', ')

    return {
      suggestedTags,
      topicSummary,
    }
  }

  @Get('list')
  @ApiOperation({
    summary: 'List solutions with pagination',
    description: 'Retrieve solutions with optional filtering by tag or project',
  })
  @ApiQuery({ name: 'tag', type: 'string', required: false })
  @ApiQuery({ name: 'project', type: 'string', required: false })
  @ApiQuery({ name: 'page', type: 'number', required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: 'number', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated solution list' })
  list(
    @Query('tag') tag?: string,
    @Query('project') project?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.kbService.list({
      tag,
      project,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    })
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get solution by ID',
    description: 'Retrieve a single solution with all details and relationships',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Solution details' })
  @ApiResponse({ status: 404, description: 'Solution not found' })
  getById(@Param('id') id: string) {
    return this.kbService.getById(id)
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update solution',
    description: 'Modify solution content or metadata',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Solution updated successfully' })
  update(@Param('id') id: string, @Body() dto: UpdateKbDto) {
    return this.kbService.update(id, dto)
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete solution',
    description: 'Remove a solution from the knowledge base',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Solution deleted successfully' })
  delete(@Param('id') id: string) {
    return this.kbService.delete(id)
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Get solution revision history',
    description: 'Retrieve all revisions of a solution with timestamps and tags snapshots',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Solution history with revisions' })
  @ApiResponse({ status: 404, description: 'Solution not found' })
  getHistory(@Param('id') id: string) {
    return this.kbService.getHistory(id)
  }
}
