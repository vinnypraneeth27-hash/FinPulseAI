ALTER TABLE public.financial_goals
  ADD COLUMN IF NOT EXISTS initial_saved_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_contribution numeric;

UPDATE public.financial_goals
SET monthly_contribution = COALESCE(
  CASE
    WHEN duration_unit = 'years' THEN
      ROUND(GREATEST(target_amount - initial_saved_amount, 0) / NULLIF(duration * 12, 0), 2)
    WHEN duration_unit = 'days' THEN
      ROUND(GREATEST(target_amount - initial_saved_amount, 0) / NULLIF(duration, 0) * 30, 2)
    ELSE
      ROUND(GREATEST(target_amount - initial_saved_amount, 0) / NULLIF(duration, 0), 2)
  END,
  0
)
WHERE monthly_contribution IS NULL;

ALTER TABLE public.financial_goals
  ALTER COLUMN monthly_contribution SET NOT NULL;
