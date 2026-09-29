import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateExpenseDto } from './dto/create-expense.dto.js';
import { UpdateExpenseDto } from './dto/update-expense.dto.js';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class ExpensesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(createExpenseDto: CreateExpenseDto) {
    const { data, error } = await this.supabaseService.getClient()
      .from('expenses')
      .insert([createExpenseDto])
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async findAll(userId: string) {
    const { data, error } = await this.supabaseService.getClient()
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('spent_on', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabaseService.getClient()
      .from('expenses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async update(id: string, updateExpenseDto: UpdateExpenseDto) {
    const { data, error } = await this.supabaseService.getClient()
      .from('expenses')
      .update(updateExpenseDto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async remove(id: string) {
    const { error } = await this.supabaseService.getClient()
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw new InternalServerErrorException(error.message);
    return { message: 'Expense deleted successfully' };
  }
}