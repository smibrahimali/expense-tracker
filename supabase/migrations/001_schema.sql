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

-- Table: categories
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
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  category_id uuid REFERENCES categories NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  spent_on date NOT NULL,
  note varchar(140),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX expenses_user_id_spent_on_idx ON expenses (user_id, spent_on DESC);