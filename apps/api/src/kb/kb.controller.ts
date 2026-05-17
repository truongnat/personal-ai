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
import { Throttle } from '@nestjs/throttler'
import { KbService } from './kb.service'
import { ApiKeyGuard } from '../auth/api-key.guard'
import { PushKbDto } from './dto/push-kb.dto'
import { UpdateKbDto } from './dto/update-kb.dto'
import { SearchKbDto } from './dto/search-kb.dto'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

@Controller('kb')
@UseGuards(ApiKeyGuard)
export class KbController {
  constructor(private kbService: KbService) {}

  @Post('push')
  push(@Body() dto: PushKbDto) {
    return this.kbService.push(dto)
  }

  @Throttle({ short: { limit: 2, ttl: 1000 } })
  @Get('search')
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

  @Get('list')
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
  getById(@Param('id') id: string) {
    return this.kbService.getById(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateKbDto) {
    return this.kbService.update(id, dto)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.kbService.delete(id)
  }
}
