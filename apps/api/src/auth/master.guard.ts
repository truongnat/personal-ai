import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class MasterGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest()
    const password = req.headers['x-master-password']
    if (!password || password !== this.config.get('MASTER_PASSWORD')) {
      throw new UnauthorizedException('Wrong master password')
    }
    return true
  }
}
