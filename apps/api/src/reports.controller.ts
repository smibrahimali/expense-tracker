import { Controller, Get, Query, Request } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('monthly')
  async getMonthlyReport(@Request() req, @Query('month') month: string) {
    // Extracts the user ID from the AuthGuard (or fallback header for testing)
    const userId = req.user?.id || req.headers['x-user-id']; 
    
    if (!userId) {
      return { error: 'Unauthorized: No user ID found' };
    }

    return this.reportsService.getMonthlyReport(userId, month);
  }
}