export class CreateExpenseDto {
  user_id?: string;
  category_id: string;
  amount_minor: number;
  spent_on: string;
  note?: string;
  payment_method?: 'cash' | 'card' | 'bank';
}