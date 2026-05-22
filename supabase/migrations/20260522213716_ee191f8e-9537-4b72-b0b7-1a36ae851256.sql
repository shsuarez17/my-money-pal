
CREATE TABLE public.snaptrade_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  snaptrade_user_id text NOT NULL UNIQUE,
  user_secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.snaptrade_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own snaptrade row" ON public.snaptrade_users
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS investments_external_unique
  ON public.investments(user_id, source, external_id) WHERE external_id IS NOT NULL;
