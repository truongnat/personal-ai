import { Module } from '@nestjs/common'
import { SkillService } from './skill.service'
import { SkillController } from './skill.controller'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  providers: [SkillService],
  controllers: [SkillController],
})
export class SkillModule {}
