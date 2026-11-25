import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

type AuthedRequest = {
  user?: { id: string };
};

@Controller('expenses')
@UseGuards(SupabaseAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  private requireUserId(req: AuthedRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user not found on request.');
    }
    return userId;
  }

  @Post()
  create(@Body() createExpenseDto: CreateExpenseDto, @Req() req: AuthedRequest) {
    const userId = this.requireUserId(req);
    return this.expensesService.create({
      ...createExpenseDto,
      user_id: userId,
    });
  }

  @Get()
  findAll(@Req() req: AuthedRequest) {
    return this.expensesService.findAll(this.requireUserId(req));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.expensesService.findOne(id, this.requireUserId(req));
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateExpenseDto: UpdateExpenseDto,
    @Req() req: AuthedRequest,
  ) {
    return this.expensesService.update(id, updateExpenseDto, this.requireUserId(req));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.expensesService.remove(id, this.requireUserId(req));
  }
}
