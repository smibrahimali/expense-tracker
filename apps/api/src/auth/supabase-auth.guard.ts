import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: { id: string; email?: string };
    }>();

    const authHeader = request.headers.authorization || request.headers.Authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization bearer token.');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing access token.');
    }

    const { data, error } = await this.supabaseService.getClient().auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    request.user = { id: data.user.id, email: data.user.email };
    return true;
  }
}
