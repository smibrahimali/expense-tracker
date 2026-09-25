import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { ExpensesModule } from './expenses/expenses.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    ExpensesModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}