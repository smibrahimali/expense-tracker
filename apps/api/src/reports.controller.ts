import { Controller, Get, Query, Req } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('monthly')
  async getMonthlyReport(@Req() req: Record<string, unknown>, @Query('month') month: string) {
    const request = req as { user?: { id?: string }, headers?: Record<string, string> };
    const userId = request.user?.id || request.headers?.['x-user-id']; 

    if (!userId) {
      return { error: 'Unauthorized: No user ID found' };
    }

    return this.reportsService.getMonthlyReport(userId, month);
  }
}