import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ExpensesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(createExpenseDto: CreateExpenseDto) {
    const { user_id: _ignored, ...rest } = createExpenseDto as CreateExpenseDto & {
      user_id?: string;
    };
    if (
      typeof rest.amount_minor !== 'number' ||
      !Number.isFinite(rest.amount_minor) ||
      rest.amount_minor <= 0
    ) {
      throw new BadRequestException('amount_minor must be a positive integer');
    }
    const payload = {
      ...rest,
      user_id: createExpenseDto.user_id,
      note: rest.note?.slice(0, 140),
    };
    const { data, error } = await this.supabaseService
      .getClient()
      .from('expenses')
      .insert([payload])
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async findAll(userId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async findOne(id: string, userId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('expenses')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw new NotFoundException(error.message);
    return data;
  }

  async update(id: string, updateExpenseDto: UpdateExpenseDto, userId: string) {
    const { user_id: _drop, ...safe } = updateExpenseDto as UpdateExpenseDto & {
      user_id?: string;
    };
    if (
      safe.amount_minor !== undefined &&
      (typeof safe.amount_minor !== 'number' ||
        !Number.isFinite(safe.amount_minor) ||
        safe.amount_minor <= 0)
    ) {
      throw new BadRequestException('amount_minor must be a positive integer');
    }
    if (safe.note !== undefined && safe.note !== null) {
      safe.note = String(safe.note).slice(0, 140);
    }
    const { data, error } = await this.supabaseService
      .getClient()
      .from('expenses')
      .update(safe)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new NotFoundException(error.message);
    return data;
  }

  async remove(id: string, userId: string) {
    const { error } = await this.supabaseService
      .getClient()
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw new InternalServerErrorException(error.message);
    return { message: 'Expense deleted successfully' };
  }
}
