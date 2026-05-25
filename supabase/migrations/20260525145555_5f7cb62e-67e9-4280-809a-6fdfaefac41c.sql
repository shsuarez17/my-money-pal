
ALTER TABLE public.recurring_contributions
  ADD COLUMN IF NOT EXISTS asset_category text,
  ADD COLUMN IF NOT EXISTS goal_id uuid,
  ADD COLUMN IF NOT EXISTS last_run date;
