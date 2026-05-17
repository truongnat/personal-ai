import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common'
import { AuthService } from './auth.service'

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest()
    const key = req.headers['x-api-key']
    if (!key) throw new UnauthorizedException('Missing API key')
    const valid = await this.authService.validateKey(key)
    if (!valid) throw new UnauthorizedException('Invalid API key')
    return true
  }
}
