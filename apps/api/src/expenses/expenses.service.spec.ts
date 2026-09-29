import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { ExpensesService } from './expenses.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';

describe('ExpensesService', () => {
  let service: ExpensesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnThis(),
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});