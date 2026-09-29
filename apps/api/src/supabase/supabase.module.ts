import { Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service.js';

@Module({
  providers: [SupabaseService],
  exports: [SupabaseService], // This exposes the service to other modules
})
export class SupabaseModule {}