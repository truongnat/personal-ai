import { Module } from '@nestjs/common'
import { KbService } from './kb.service'
import { KbController } from './kb.controller'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  providers: [KbService],
  controllers: [KbController],
})
export class KbModule {}
