import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { RefreshCw, Wallet, LineChart as LineChartIcon, Bitcoin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { fmtPct, fmtUSD, fmtCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { refreshPrices } from "@/lib/prices.functions";
import { useProfile, useUsdRates, CURRENCIES, type Currency } from "@/lib/use-profile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
const STOCK_TYPES = new Set(["STOCK_US", "STOCK_CO", "ETF", "BOND"]);
const PAGE_SIZE = 10;

function Dashboard() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const refresh = useServerFn(refreshPrices);
  const profileQ = useProfile();
  const ratesQ = useUsdRates();
  const baseCcy = (profileQ.data?.base_currency ?? "USD") as Currency;
  const rates = ratesQ.data ?? { USD: 1, COP: 4000, EUR: 0.92, MXN: 18, BRL: 5 };
  const [viewCcy, setViewCcy] = useState<Currency>(baseCcy === "USD" ? "COP" : baseCcy);

  const holdingsQ = useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("investments").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const goalsQ = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const goalContribsQ = useQuery({
    queryKey: ["goal_contributions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goal_contributions").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [page, setPage] = useState(1);

  const customTypeNames = useMemo(
    () => new Set((profileQ.data?.custom_asset_types ?? []).map((s) => s.toUpperCase().slice(0, 8))),
    [profileQ.data]
  );

  const invested = useMemo(() => {
    return (holdingsQ.data ?? []).reduce((a, h) => a + Number(h.quantity) * Number(h.avg_cost_usd), 0);
  }, [holdingsQ.data]);

  const rate = rates[viewCcy] || 1;

  // Counts per category (unique by name within category)
  const counts = useMemo(() => {
    const stocks = new Set<string>();
    const crypto = new Set<string>();
    const custom = new Set<string>();
    for (const h of holdingsQ.data ?? []) {
      const key = h.name.toLowerCase();
      const isCustom = customTypeNames.has((h.ticker ?? "").toUpperCase());
      if (isCustom) custom.add(key);
      else if (h.asset_type === "CRYPTO") crypto.add(key);
      else if (STOCK_TYPES.has(h.asset_type)) stocks.add(key);
    }
    return { stocks: stocks.size, crypto: crypto.size, custom: custom.size };
  }, [holdingsQ.data, customTypeNames]);

  // Distribution grouped by name (no repeats), value = sum invested USD
  const distribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of holdingsQ.data ?? []) {
      const inv = Number(h.quantity) * Number(h.avg_cost_usd);
      map.set(h.name, (map.get(h.name) ?? 0) + inv);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [holdingsQ.data]);

  // Evolution: accumulated invested USD by purchase_date.
  const evolution = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const h of holdingsQ.data ?? []) {
      const d = h.purchase_date ?? new Date(h.created_at).toISOString().slice(0, 10);
      const inv = Number(h.quantity) * Number(h.avg_cost_usd);
      byDate.set(d, (byDate.get(d) ?? 0) + inv);
    }
    const sorted = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));
    let acc = 0;
    return sorted.map(([date, v]) => {
      acc += v;
      return { date, day_usd: v, total_usd: acc, day_view: v * rate, total_view: acc * rate };
    });
  }, [holdingsQ.data, rate]);

  const goalsSummary = useMemo(() => {
    const contribsByGoal = new Map<string, number>();
    for (const c of goalContribsQ.data ?? []) {
      contribsByGoal.set(c.goal_id, (contribsByGoal.get(c.goal_id) ?? 0) + Number(c.amount_usd));
    }
    return (goalsQ.data ?? []).map((g) => {
      const saved = contribsByGoal.get(g.id) ?? 0;
      const target = Number(g.target_amount_usd) || 0;
      const pct = target > 0 ? saved / target : 0;
      return { id: g.id, name: g.name, currency: g.currency, target, saved, pct };
    });
  }, [goalsQ.data, goalContribsQ.data]);

  const refreshMut = useMutation({
    mutationFn: () => refresh(),
    onSuccess: (r) => {
      toast.success(t("pricesUpdated") + (r?.updated ? ` (${r.updated})` : ""));
      qc.invalidateQueries({ queryKey: ["investments"] });
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
        <div className="flex items-center gap-2">
          <Select value={viewCcy} onValueChange={(v) => setViewCcy(v as Currency)}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.filter((c) => c !== "USD").map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => refreshMut.mutate()} disabled={refreshMut.isPending}>
            <RefreshCw className={`size-4 mr-2 ${refreshMut.isPending ? "animate-spin" : ""}`} /> {t("refreshPrices")}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <StatCard
          label={`${t("totalInvested")} · USD`}
          value={fmtUSD(invested)}
          accent="primary"
          icon={<Wallet className="size-4" />}
          sub={`USD · Dólar estadounidense`}
        />
        <StatCard
          label={`${t("totalInvested")} · ${viewCcy}`}
          value={fmtCurrency(invested * rate, viewCcy)}
          accent="gold"
          sub={`1 USD = ${fmtCurrency(rate, viewCcy)}`}
        />
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <StatCard label={`Total · ${t("numAssets")}`} value={String(counts.stocks + counts.crypto + counts.custom)} icon={<Wallet className="size-4" />} accent="primary" />
        <StatCard label={`${t("stocks")}`} value={String(counts.stocks)} icon={<LineChartIcon className="size-4" />} muted />
        <StatCard label={`${t("crypto")}`} value={String(counts.crypto)} icon={<Bitcoin className="size-4" />} muted />
        <StatCard label={`${t("customSheets")}`} value={String(counts.custom)} icon={<Layers className="size-4" />} muted />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{t("evolution")}</h3>
            <span className="text-xs font-mono text-muted-foreground">USD</span>
          </div>
          {evolution.length === 0 ? (
            <EmptyChart label={t("noData")} />
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={evolution}>
                  <defs>
                    <linearGradient id="pgrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => `$${Math.round(v)}`} />
                  <Tooltip
                    contentStyle={{ background: "#0a0a0a", border: "1px solid var(--border)", borderRadius: 12, color: "#fff" }}
                    labelStyle={{ color: "#fff" }}
                    itemStyle={{ color: "#fff" }}
                    formatter={(v: number, name: string) => [fmtUSD(v), name === "day_usd" ? "Aporte del día" : "Acumulado"]}
                  />
                  <Area type="monotone" dataKey="total_usd" name="Acumulado" stroke="var(--chart-1)" strokeWidth={2} fill="url(#pgrad)" />
                  <Area type="monotone" dataKey="day_usd" name="Aporte del día" stroke="var(--chart-3)" strokeWidth={2} fill="transparent" />
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
                    <Pie
                      data={distribution}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                      label={({ percent }: any) => (percent && percent > 0.03 ? `${(percent * 100).toFixed(0)}%` : "")}
                      labelLine={false}
                    >
                      {distribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => fmtUSD(v)}
                      contentStyle={{ background: "#0a0a0a", border: "1px solid var(--border)", borderRadius: 12, color: "#fff" }}
                      labelStyle={{ color: "#fff" }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-4 max-h-40 overflow-y-auto pr-1">
                {distribution.map((d, i) => {
                  const pct = invested ? d.value / invested : 0;
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

      {/* Goals summary */}
      <div className="card-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{t("goals")}</h3>
          <Link to="/goals" className="text-xs font-mono text-primary hover:underline">{t("goals")} →</Link>
        </div>
        {goalsSummary.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noData")}</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {goalsSummary.map((g) => (
              <div key={g.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold truncate">{g.name}</span>
                  <span className="text-xs font-mono text-muted-foreground">{fmtPct(g.pct)}</span>
                </div>
                <Progress value={Math.min(100, g.pct * 100)} className="h-2" />
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground tabular font-mono">
                  <span>{fmtUSD(g.saved)}</span>
                  <span>/ {fmtUSD(g.target)}</span>
                </div>
                {g.pct >= 1 && <p className="text-xs text-success mt-1">{t("overflow")}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{t("activeAssets")}</h3>
          <span className="text-xs font-mono text-muted-foreground">1 USD = {fmtCurrency(rate, viewCcy)}</span>
        </div>
        {(holdingsQ.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noData")}</p>
        ) : (
          <>
          {(() => {
            const map = new Map<string, { name: string; type: string; invested: number }>();
            for (const h of holdingsQ.data ?? []) {
              const key = `${h.asset_type}::${h.name.toLowerCase()}`;
              const inv = Number(h.quantity) * Number(h.avg_cost_usd);
              const e = map.get(key) ?? { name: h.name, type: h.asset_type, invested: 0 };
              e.invested += inv;
              map.set(key, e);
            }
            const rows = Array.from(map.values()).sort((a, b) => b.invested - a.invested);
            const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
            const safePage = Math.min(page, totalPages);
            const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
            return (
              <>
              <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left py-2">{t("assetName")}</th>
                  <th className="text-left">{t("type")}</th>
                  <th className="text-right">{t("totalInvested")} (USD)</th>
                  <th className="text-right">{viewCcy}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-3 font-semibold">{r.name}</td>
                      <td className="text-xs text-muted-foreground">{r.type}</td>
                      <td className="text-right tabular font-mono font-semibold">{fmtUSD(r.invested)}</td>
                      <td className="text-right tabular font-mono text-muted-foreground">{fmtCurrency(r.invested * rate, viewCcy)}</td>
                    </tr>
                ))}
              </tbody>
            </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 mt-4">
                  <Button variant="ghost" size="sm" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>‹</Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Button key={p} variant={p === safePage ? "default" : "ghost"} size="sm" onClick={() => setPage(p)}>{p}</Button>
                  ))}
                  <Button variant="ghost" size="sm" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>›</Button>
                </div>
              )}
              </>
            );
          })()}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, muted, icon, tone, sub }: {
  label: string; value: string; accent?: "primary" | "gold"; muted?: boolean; icon?: React.ReactNode; tone?: "success" | "danger"; sub?: string;
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
      {sub && <p className="text-[11px] font-mono text-muted-foreground mt-1">{sub}</p>}
    </motion.div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">{label}</div>;
}
