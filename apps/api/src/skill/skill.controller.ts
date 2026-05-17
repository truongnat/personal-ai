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
import { SkillService } from './skill.service'
import { ApiKeyGuard } from '../auth/api-key.guard'
import { PublishSkillDto } from './dto/publish-skill.dto'
import { ComposeSkillDto } from './dto/compose-skill.dto'
import { UpdateSkillDto } from './dto/update-skill.dto'

@Controller('skill')
@UseGuards(ApiKeyGuard)
export class SkillController {
  constructor(private skillService: SkillService) {}

  @Post('publish')
  publish(@Body() dto: PublishSkillDto) {
    return this.skillService.publish(dto)
  }

  @Post('compose')
  compose(@Body() dto: ComposeSkillDto) {
    return this.skillService.compose(dto)
  }

  @Get('install/:name')
  install(@Param('name') name: string, @Query('version') version?: string) {
    return this.skillService.install(name, version)
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.skillService.searchSkills(q)
  }

  @Get('list')
  list() {
    return this.skillService.list()
  }

  @Get(':name')
  getByName(@Param('name') name: string) {
    return this.skillService.getByName(name)
  }

  @Patch(':name')
  update(@Param('name') name: string, @Body() dto: UpdateSkillDto) {
    return this.skillService.update(name, dto)
  }

  @Delete(':name')
  delete(@Param('name') name: string) {
    return this.skillService.delete(name)
  }
}
