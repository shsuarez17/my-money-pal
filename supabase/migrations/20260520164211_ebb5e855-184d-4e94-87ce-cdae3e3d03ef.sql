
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_asset_types text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
ALTER TABLE public.recurring_contributions ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
