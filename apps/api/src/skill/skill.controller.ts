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
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiQuery, ApiParam } from '@nestjs/swagger'
import { SkillService } from './skill.service'
import { ApiKeyGuard } from '../auth/api-key.guard'
import { PublishSkillDto } from './dto/publish-skill.dto'
import { ComposeSkillDto } from './dto/compose-skill.dto'
import { UpdateSkillDto } from './dto/update-skill.dto'

@Controller('skill')
@UseGuards(ApiKeyGuard)
@ApiTags('skill')
@ApiHeader({
  name: 'x-api-key',
  description: 'API key for authentication',
  required: true,
})
export class SkillController {
  constructor(private skillService: SkillService) {}

  @Post('publish')
  @ApiOperation({
    summary: 'Publish new skill version',
    description: 'Create or update a skill with a new version',
  })
  @ApiResponse({
    status: 201,
    description: 'Skill published successfully',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        version: { type: 'string', example: '1.0.0' },
        published_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  publish(@Body() dto: PublishSkillDto) {
    return this.skillService.publish(dto)
  }

  @Post('compose')
  @ApiOperation({
    summary: 'Compose multiple skills',
    description: 'Merge multiple skills and optionally inject KB phases',
  })
  @ApiResponse({
    status: 200,
    description: 'Composed skill document',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        content: { type: 'string', description: 'Merged markdown content' },
        skills_merged: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  compose(@Body() dto: ComposeSkillDto) {
    return this.skillService.compose(dto)
  }

  @Get('install/:name')
  @ApiOperation({
    summary: 'Install skill by name',
    description: 'Retrieve skill files for local installation',
  })
  @ApiParam({ name: 'name', type: 'string', description: 'Skill name' })
  @ApiQuery({ name: 'version', type: 'string', required: false, description: 'Specific version (optional)' })
  @ApiResponse({ status: 200, description: 'Skill files and metadata' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  install(@Param('name') name: string, @Query('version') version?: string) {
    return this.skillService.install(name, version)
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search skills',
    description: 'Full-text search across skill names, descriptions, and tags',
  })
  @ApiQuery({ name: 'q', type: 'string', description: 'Search query (required)' })
  @ApiResponse({ status: 200, description: 'Matching skills' })
  search(@Query('q') q: string) {
    return this.skillService.searchSkills(q)
  }

  @Get('list')
  @ApiOperation({
    summary: 'List all skills',
    description: 'Retrieve all available skills with versions and compatibility info',
  })
  @ApiResponse({ status: 200, description: 'List of all skills' })
  list() {
    return this.skillService.list()
  }

  @Get(':name')
  @ApiOperation({
    summary: 'Get skill details',
    description: 'Retrieve detailed information about a specific skill',
  })
  @ApiParam({ name: 'name', type: 'string', description: 'Skill name' })
  @ApiResponse({ status: 200, description: 'Skill details with versions' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  getByName(@Param('name') name: string) {
    return this.skillService.getByName(name)
  }

  @Patch(':name')
  @ApiOperation({
    summary: 'Update skill metadata',
    description: 'Update description or publish new version',
  })
  @ApiParam({ name: 'name', type: 'string', description: 'Skill name' })
  @ApiResponse({ status: 200, description: 'Skill updated successfully' })
  update(@Param('name') name: string, @Body() dto: UpdateSkillDto) {
    return this.skillService.update(name, dto)
  }

  @Delete(':name')
  @ApiOperation({
    summary: 'Delete skill',
    description: 'Remove a skill and all its versions',
  })
  @ApiParam({ name: 'name', type: 'string', description: 'Skill name' })
  @ApiResponse({ status: 200, description: 'Skill deleted successfully' })
  delete(@Param('name') name: string) {
    return this.skillService.delete(name)
  }
}
