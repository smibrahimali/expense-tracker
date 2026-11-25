import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';

type AuthedRequest = {
  user?: { id: string };
};

@Controller('reports')
@UseGuards(SupabaseAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('monthly')
  async getMonthlyReport(
    @Req() req: AuthedRequest,
    @Query('month') month: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user not found on request.');
    }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('Query param month must be YYYY-MM.');
    }

    return this.reportsService.getMonthlyReport(userId, month);
  }
}
