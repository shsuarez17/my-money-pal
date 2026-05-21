CREATE TABLE public.goal_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal_id uuid NOT NULL,
  amount_usd numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own gc all" ON public.goal_contributions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_goal_contributions_goal_id ON public.goal_contributions(goal_id);
CREATE INDEX idx_goal_contributions_user_id ON public.goal_contributions(user_id);