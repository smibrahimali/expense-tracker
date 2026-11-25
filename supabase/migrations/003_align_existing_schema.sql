-- Idempotent upgrades for databases that already applied the older UUID-based schema.

-- Drop leftover scaffolding if present
DROP TABLE IF EXISTS public.hello;

-- Convert expenses.category_id from uuid FK → text category name (if still uuid)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'expenses'
      AND column_name = 'category_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_id_fkey;

    ALTER TABLE public.expenses
      ALTER COLUMN category_id TYPE text
      USING COALESCE(
        (SELECT c.name FROM public.categories c WHERE c.id = expenses.category_id),
        'Other'
      );
  END IF;
END $$;

-- payment_method
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS payment_method text;

UPDATE public.expenses
SET payment_method = 'cash'
WHERE payment_method IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_payment_method_check'
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_payment_method_check
      CHECK (payment_method IN ('cash', 'card', 'bank'));
  END IF;
END $$;

ALTER TABLE public.expenses
  ALTER COLUMN payment_method SET DEFAULT 'cash';

ALTER TABLE public.expenses
  ALTER COLUMN payment_method SET NOT NULL;

-- expense_drafts for AI chat sessions
CREATE TABLE IF NOT EXISTS public.expense_drafts (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  item text,
  amount numeric,
  date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expense_drafts_user_id_idx ON public.expense_drafts (user_id);

ALTER TABLE public.expense_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'expense_drafts'
      AND policyname = 'Users can manage own drafts'
  ) THEN
    CREATE POLICY "Users can manage own drafts"
      ON public.expense_drafts
      FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Keep signup seed in sync with app predefined categories
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (new.id);

  INSERT INTO public.categories (user_id, name, color) VALUES
    (new.id, 'Housing', '#EF4444'),
    (new.id, 'Food', '#F59E0B'),
    (new.id, 'Transportation', '#3B82F6'),
    (new.id, 'Utilities', '#EAB308'),
    (new.id, 'Health', '#10B981'),
    (new.id, 'Shopping', '#EC4899'),
    (new.id, 'Entertainment', '#8B5CF6'),
    (new.id, 'Education', '#6366F1'),
    (new.id, 'Personal', '#14B8A6'),
    (new.id, 'Other', '#71717A');

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
