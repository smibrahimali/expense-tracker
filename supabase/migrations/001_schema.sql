-- Table: profiles
CREATE TABLE profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  currency_code char(3) NOT NULL DEFAULT 'PKR',
  timezone text NOT NULL DEFAULT 'Asia/Karachi',
  created_at timestamptz DEFAULT now()
);

-- Table: monthly_salaries
CREATE TABLE monthly_salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  month date NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  UNIQUE(user_id, month)
);

-- Table: categories (display/metadata for user category names)
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name varchar(40) NOT NULL,
  color varchar(7) NOT NULL,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX categories_user_id_name_idx ON categories (user_id, lower(name));

-- Table: expenses
-- category_id stores the category *name* (text) to match the app UI + AI logger
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  category_id text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  spent_on date NOT NULL,
  note varchar(140),
  payment_method text NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'card', 'bank')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX expenses_user_id_spent_on_idx ON expenses (user_id, spent_on DESC);

-- Multi-turn AI chat draft / edit sessions
CREATE TABLE expense_drafts (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  item text,
  amount numeric,
  date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX expense_drafts_user_id_idx ON expense_drafts (user_id);
