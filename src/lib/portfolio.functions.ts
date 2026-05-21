import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const recordSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: holdings } = await supabase
      .from("investments").select("quantity,current_price_usd,avg_cost_usd").eq("user_id", userId);
    const totalUsd = (holdings ?? []).reduce((a, h) => a + Number(h.quantity) * Number(h.current_price_usd), 0);
    const invested = (holdings ?? []).reduce((a, h) => a + Number(h.quantity) * Number(h.avg_cost_usd), 0);

    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const j = r.ok ? (await r.json() as any) : {};
    const fx = j?.rates?.COP ?? 4000;

    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("portfolio_snapshots").upsert({
      user_id: userId, snapshot_date: today,
      total_usd: totalUsd, total_cop: totalUsd * fx, invested_usd: invested,
    }, { onConflict: "user_id,snapshot_date" });
    return { totalUsd, invested, fx };
  });
