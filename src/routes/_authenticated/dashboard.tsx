import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { ArrowDownRight, ArrowUpRight, RefreshCw, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { fmtCOP, fmtPct, fmtUSD } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { refreshPrices, getFxUsdCop } from "@/lib/prices.functions";
import { recordSnapshot } from "@/lib/portfolio.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

function Dashboard() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const refresh = useServerFn(refreshPrices);
  const snap = useServerFn(recordSnapshot);
  const getFx = useServerFn(getFxUsdCop);

  const holdingsQ = useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("investments").select("*").order("created_at");
      if (error) throw error; return data ?? [];
    },
  });

  const snapsQ = useQuery({
    queryKey: ["snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("portfolio_snapshots").select("*").order("snapshot_date").limit(180);
      if (error) throw error; return data ?? [];
    },
  });

  const fxQ = useQuery({ queryKey: ["fx"], queryFn: async () => (await getFx()).rate, staleTime: 5 * 60_000 });

  const totals = useMemo(() => {
    const list = holdingsQ.data ?? [];
    const totalUsd = list.reduce((a, h) => a + Number(h.quantity) * Number(h.current_price_usd || h.avg_cost_usd), 0);
    const invested = list.reduce((a, h) => a + Number(h.quantity) * Number(h.avg_cost_usd), 0);
    const pnl = totalUsd - invested;
    return { totalUsd, invested, pnl, pnlPct: invested ? pnl / invested : 0 };
  }, [holdingsQ.data]);

  const fx = fxQ.data ?? 4000;

  const distribution = useMemo(() => {
    return (holdingsQ.data ?? []).map((h) => ({
      name: h.ticker,
      value: Number(h.quantity) * Number(h.current_price_usd || h.avg_cost_usd),
    })).filter(x => x.value > 0).sort((a, b) => b.value - a.value);
  }, [holdingsQ.data]);

  // Take snapshot on load (best-effort)
  useEffect(() => {
    if ((holdingsQ.data?.length ?? 0) > 0) snap().then(() => qc.invalidateQueries({ queryKey: ["snapshots"] })).catch(() => {});
  }, [holdingsQ.data, snap, qc]);

  const refreshMut = useMutation({
    mutationFn: () => refresh(),
    onSuccess: (r) => {
      toast.success(t("pricesUpdated") + (r?.updated ? ` (${r.updated})` : ""));
      qc.invalidateQueries({ queryKey: ["investments"] });
      qc.invalidateQueries({ queryKey: ["fx"] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("error")),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase font-mono tracking-widest text-muted-foreground">{t("portfolioOverview")}</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold mt-1">{t("dashboard")}</h1>
        </div>
        <Button onClick={() => refreshMut.mutate()} disabled={refreshMut.isPending}>
          <RefreshCw className={`size-4 mr-2 ${refreshMut.isPending ? "animate-spin" : ""}`} /> {t("refreshPrices")}
        </Button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <StatCard label={t("totalUSD")} value={fmtUSD(totals.totalUsd)} accent="primary" icon={<Wallet className="size-4" />} />
        <StatCard label={t("totalCOP")} value={fmtCOP(totals.totalUsd * fx)} accent="gold" />
        <StatCard label={t("invested")} value={fmtUSD(totals.invested)} muted />
        <StatCard
          label={t("pnl")}
          value={`${fmtUSD(totals.pnl)} (${fmtPct(totals.pnlPct)})`}
          icon={totals.pnl >= 0 ? <ArrowUpRight className="size-4 text-success" /> : <ArrowDownRight className="size-4 text-destructive" />}
          tone={totals.pnl >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{t("evolution")}</h3>
            <span className="text-xs font-mono text-muted-foreground">USD</span>
          </div>
          {(snapsQ.data?.length ?? 0) === 0 ? (
            <EmptyChart label={lang === "es" ? "Aún no hay historial. Vuelve mañana." : "No history yet. Come back tomorrow."} />
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={snapsQ.data ?? []}>
                  <defs>
                    <linearGradient id="pgrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="snapshot_date" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => `$${Math.round(v)}`} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  <Area type="monotone" dataKey="total_usd" stroke="var(--chart-1)" strokeWidth={2} fill="url(#pgrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-6">
          <h3 className="font-semibold mb-4">{t("distribution")}</h3>
          {distribution.length === 0 ? (
            <EmptyChart label={t("noData")} />
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {distribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtUSD(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-4 max-h-40 overflow-y-auto pr-1">
                {distribution.map((d, i) => {
                  const pct = d.value / totals.totalUsd;
                  return (
                    <div key={d.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="font-medium">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-3 tabular text-muted-foreground">
                        <span>{fmtUSD(d.value)}</span>
                        <span className="text-foreground font-mono">{fmtPct(pct)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>
      </div>

      <div className="card-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{t("activeAssets")}</h3>
          <span className="text-xs font-mono text-muted-foreground">{t("fxRate")}: {fmtCOP(fx).replace("COP", "").trim()}</span>
        </div>
        {(holdingsQ.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noData")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left py-2">{t("assetName")}</th>
                  <th className="text-left">{t("type")}</th>
                  <th className="text-right">#</th>
                  <th className="text-right">{t("totalInvested")} (USD)</th>
                  <th className="text-right">COP</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const map = new Map<string, { name: string; type: string; invested: number; count: number }>();
                  for (const h of holdingsQ.data ?? []) {
                    const key = `${h.asset_type}::${h.name.toLowerCase()}`;
                    const inv = Number(h.quantity) * Number(h.avg_cost_usd);
                    const e = map.get(key) ?? { name: h.name, type: h.asset_type, invested: 0, count: 0 };
                    e.invested += inv; e.count += 1;
                    map.set(key, e);
                  }
                  const rows = Array.from(map.values()).sort((a, b) => b.invested - a.invested);
                  return rows.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-3 font-semibold">{r.name}</td>
                      <td className="text-xs text-muted-foreground">{r.type}</td>
                      <td className="text-right tabular">{r.count}</td>
                      <td className="text-right tabular font-mono font-semibold">{fmtUSD(r.invested)}</td>
                      <td className="text-right tabular font-mono text-muted-foreground">{fmtCOP(r.invested * fx)}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

function StatCard({ label, value, accent, muted, icon, tone }: {
  label: string; value: string; accent?: "primary" | "gold"; muted?: boolean; icon?: React.ReactNode; tone?: "success" | "danger";
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest font-mono text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className={`stat-value text-2xl md:text-3xl mt-2 ${accent === "primary" ? "gradient-text" : accent === "gold" ? "gradient-text-gold" : muted ? "text-muted-foreground" : tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : ""}`}>
        {value}
      </div>
    </motion.div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">{label}</div>;
}
