import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  getClient(): SupabaseClient {
    if (this.supabase) {
      return this.supabase;
    }

    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new InternalServerErrorException('Supabase credentials are missing.');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    return this.supabase;
  }
}
