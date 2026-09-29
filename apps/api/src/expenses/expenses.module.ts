import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service.js';
import { ExpensesController } from './expenses.controller.js';
import { SupabaseModule } from '../supabase/supabase.module.js';

@Module({
  imports: [SupabaseModule], // Bring in the database connection
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}