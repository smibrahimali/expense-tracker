export class CreateExpenseDto {
    category_id: string;
    amount_minor: number;
    spent_on: string;
    note?: string;
  }