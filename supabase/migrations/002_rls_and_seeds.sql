-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for strict data isolation
CREATE POLICY "Users can manage own profile" ON profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own salaries" ON monthly_salaries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own categories" ON categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own expenses" ON expenses FOR ALL USING (auth.uid() = user_id);

-- Automate default profile and categories on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (new.id);
  
  INSERT INTO public.categories (user_id, name, color) VALUES 
    (new.id, 'Housing', '#EF4444'),
    (new.id, 'Food', '#F59E0B'),
    (new.id, 'Transportation', '#3B82F6'),
    (new.id, 'Padel & Sports', '#10B981'),
    (new.id, 'Subscriptions', '#8B5CF6');
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();