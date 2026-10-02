import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class ReportsService {
    private supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_KEY as string);
    
  async getMonthlyReport(userId: string, targetMonth: string) {
    // targetMonth should be 'YYYY-MM'
    const startDate = new Date(`${targetMonth}-01T00:00:00Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // 1. Fetch Salary
    const { data: salaryData } = await this.supabase
      .from('monthly_salaries')
      .select('amount_minor')
      .eq('user_id', userId)
      .eq('month', `${targetMonth}-01`)
      .single();

    const salary = salaryData?.amount_minor || 0;

    // 2. Fetch Expenses for the month
    const { data: expenses } = await this.supabase
      .from('expenses')
      .select('amount_minor, category_id')
      .eq('user_id', userId)
      .gte('spent_on', startDate.toISOString())
      .lt('spent_on', endDate.toISOString());

    // 3. Calculate Totals (in minor units)
    const spent = (expenses || []).reduce((sum, exp) => sum + Number(exp.amount_minor), 0);
    const remaining = salary - spent;
    
    let percentUsed = null;
    if (salary > 0) {
      percentUsed = Math.round((spent / salary) * 1000) / 10; // 1 decimal place
    }

    // 4. Calculate Category Breakdown
    const categoryTotals = (expenses || []).reduce((acc, exp) => {
      acc[exp.category_id] = (acc[exp.category_id] || 0) + Number(exp.amount_minor);
      return acc;
    }, {});

    return {
      month: targetMonth,
      salary,
      spent,
      remaining,
      percentUsed,
      categoryTotals,
    };
  }
}