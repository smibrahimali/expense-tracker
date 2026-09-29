import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new InternalServerErrorException('Supabase credentials are missing.');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // This is the missing method your expenses service is looking for!
  getClient(): SupabaseClient {
    return this.supabase;
  }
}