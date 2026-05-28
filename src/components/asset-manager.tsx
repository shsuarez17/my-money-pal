import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, CalendarIcon, ArrowRight, Search } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { fmtCurrency, fmtUSD, fmtNum, fmtPct } from "@/lib/format";
import { useProfile, useUsdRates, CURRENCIES, type Currency } from "@/lib/use-profile";
import { toast } from "sonner";

type AssetType = Database["public"]["Enums"]["asset_type"];
type Investment = Database["public"]["Tables"]["investments"]["Row"];

const BUILTIN_TYPE_LABELS: Record<string, string> = {
  STOCK_US: "Acción EEUU",
  STOCK_CO: "Acción COL",
  ETF: "ETF",
  BOND: "Bono",
  CRYPTO: "Cripto",
};

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

export function AssetManager({
  title,
  allowedTypes,
  defaultType,
  filterTypes,
  customTypeName,
}: {
  title: string;
  allowedTypes: { value: AssetType; label: string }[];
  defaultType: AssetType;
  filterTypes: AssetType[];
  /** When set, this page represents a user-defined custom sheet. Items are matched by ticker == customTypeName. */
  customTypeName?: string;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const profileQ = useProfile();
  const ratesQ = useUsdRates();
  const baseCcy = (profileQ.data?.base_currency ?? "USD") as Currency;
  const rates = ratesQ.data ?? { USD: 1, COP: 4000, EUR: 0.92, MXN: 18, BRL: 5 };

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [search, setSearch] = useState("");
  const [viewCcy, setViewCcy] = useState<Currency>(baseCcy === "USD" ? "COP" : baseCcy);

  useEffect(() => {
    setViewCcy(baseCcy === "USD" ? "COP" : baseCcy);
  }, [baseCcy]);

  const q = useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("investments").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const allMatching = (q.data ?? []).filter((h) =>
    customTypeName
      ? (h.ticker?.toUpperCase() === customTypeName.toUpperCase().slice(0, 8))
      : filterTypes.includes(h.asset_type)
  );

  const items = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return allMatching;
    return allMatching.filter((h) =>
      h.name.toLowerCase().includes(s) ||
      (h.platform ?? "").toLowerCase().includes(s) ||
      (BUILTIN_TYPE_LABELS[h.asset_type] ?? h.asset_type).toLowerCase().includes(s)
    );
  }, [allMatching, search]);

  // Aggregated summary: built from ALL matching (search does not alter totals)
  const summary = useMemo(() => {
    const map = new Map<string, { name: string; type: string; invested_usd: number; count: number }>();
    for (const h of allMatching) {
      const key = `${h.asset_type}::${h.name.toLowerCase()}`;
      const inv = Number(h.quantity) * Number(h.avg_cost_usd);
      const e = map.get(key) ?? { name: h.name, type: h.asset_type, invested_usd: 0, count: 0 };
      e.invested_usd += inv;
      e.count += 1;
      map.set(key, e);
    }
    return Array.from(map.values()).sort((a, b) => b.invested_usd - a.invested_usd);
  }, [allMatching]);

  const totalUsd = summary.reduce((a, s) => a + s.invested_usd, 0);
  const numAssets = summary.length;
  const rate = rates[viewCcy] || 1;

  // Chart data: when searching, show only filtered slices (still as % of full total)
  const chartData = useMemo(() => {
    const s = search.trim().toLowerCase();
    const base = !s
      ? summary
      : summary.filter((x) =>
          x.name.toLowerCase().includes(s) ||
          (BUILTIN_TYPE_LABELS[x.type] ?? x.type).toLowerCase().includes(s)
        );
    return base.map((x) => ({
      name: x.name,
      value: x.invested_usd,
      pct: totalUsd ? x.invested_usd / totalUsd : 0,
    }));
  }, [summary, search, totalUsd]);

  // Reset to page 1 when filter/data shrinks
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  useEffect(() => { if (page > totalPages) setPage(1); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [search]);
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("investments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["investments"] }); toast.success(t("saved")); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-3xl md:text-4xl font-display font-bold">{title}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              className="pl-8 w-48 md:w-64"
            />
          </div>
          <Select value={viewCcy} onValueChange={(v) => setViewCcy(v as Currency)}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.filter((c) => c !== "USD").map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="size-4 mr-1" /> {t("addAsset")}
          </Button>
        </div>
      </div>

      {/* SUMMARY + DONUT CHART */}
      {summary.length > 0 && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="card-surface p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">{t("summary")}</h3>
              <div className="text-xs font-mono text-muted-foreground flex items-center gap-3 flex-wrap">
                <span>{t("numAssets")}: <span className="text-foreground font-semibold">{numAssets}</span></span>
                <span>{t("totalInvested")}: <span className="text-foreground font-semibold">{fmtUSD(totalUsd)}</span></span>
                <span className="text-foreground font-semibold">{fmtCurrency(totalUsd * rate, viewCcy)}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">{t("assetName")}</th>
                    <th className="text-left">{t("type")}</th>
                    <th className="text-right">USD</th>
                    <th className="text-right">{viewCcy}</th>
                    <th className="text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-2 font-semibold">
                        <span className="inline-flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          {s.name}
                        </span>
                      </td>
                      <td className="text-xs text-muted-foreground">{BUILTIN_TYPE_LABELS[s.type] ?? s.type}</td>
                      <td className="text-right tabular font-mono">{fmtUSD(s.invested_usd)}</td>
                      <td className="text-right tabular font-mono">{fmtCurrency(s.invested_usd * rate, viewCcy)}</td>
                      <td className="text-right tabular font-mono text-foreground">{totalUsd ? fmtPct(s.invested_usd / totalUsd) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card-surface p-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-2">{t("distributionPct")}</h3>
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={summary.map((s) => ({ name: s.name, value: s.invested_usd }))}
                       dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {summary.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <RTooltip formatter={(v: number) => fmtUSD(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED TABLE */}
      <div className="card-surface p-2 md:p-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 text-center">{t("noData")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3">{t("type")}</th>
                  <th className="text-left">{t("assetName")}</th>
                  <th className="text-left">{t("platform")}</th>
                  <th className="text-left">{t("purchaseDate")}</th>
                  <th className="text-right">USD</th>
                  <th className="text-right">{viewCcy}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((h) => {
                  const inv = Number(h.quantity) * Number(h.avg_cost_usd);
                  return (
                    <tr key={h.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-xs font-semibold">
                          {BUILTIN_TYPE_LABELS[h.asset_type] ?? h.asset_type}
                        </span>
                      </td>
                      <td className="font-semibold">{h.name}</td>
                      <td className="text-muted-foreground">{h.platform ?? "—"}</td>
                      <td className="text-muted-foreground tabular text-xs">{h.purchase_date ?? "—"}</td>
                      <td className="text-right tabular">{fmtUSD(inv)}</td>
                      <td className="text-right tabular font-mono">{fmtCurrency(inv * rate, viewCcy)}</td>
                      <td className="text-right pr-3">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(h); setOpen(true); }}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm(t("confirmDelete"))) del.mutate(h.id); }}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AssetDialog
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
        allowedTypes={allowedTypes}
        defaultType={defaultType}
        baseCurrency={baseCcy}
        rates={rates}
        knownNames={Array.from(new Set((q.data ?? []).map((h) => h.name))).filter(Boolean)}
        customTypes={profileQ.data?.custom_asset_types ?? []}
        forceCustomTicker={customTypeName}
      />
    </div>
  );
}

function AssetDialog({
  open, onClose, editing, allowedTypes, defaultType, baseCurrency, rates, knownNames, customTypes, forceCustomTicker,
}: {
  open: boolean; onClose: () => void; editing: Investment | null;
  allowedTypes: { value: AssetType; label: string }[]; defaultType: AssetType;
  baseCurrency: Currency; rates: Record<Currency, number>;
  knownNames: string[]; customTypes: string[];
  forceCustomTicker?: string;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    asset_type: defaultType as string,
    name: "",
    platform: "",
    currency: baseCurrency as Currency,
    amount: "",
    purchase_date: new Date().toISOString().slice(0, 10),
  });
  // a separate currency to view the conversion in
  const [viewCurrency, setViewCurrency] = useState<Currency>(baseCurrency === "USD" ? "COP" : "USD");

  useEffect(() => {
    if (!open) return;
    const editCcy = (editing?.currency as Currency) ?? baseCurrency;
    const inv = editing ? Number(editing.quantity) * Number(editing.avg_cost_usd) : 0;
    const amountInCcy = inv * (rates[CURRENCIES.includes(editCcy) ? editCcy : "USD"] ?? 1);
    setForm({
      asset_type: editing?.asset_type ?? defaultType,
      name: editing?.name ?? "",
      platform: editing?.platform ?? "",
      currency: CURRENCIES.includes(editCcy) ? editCcy : baseCurrency,
      amount: inv ? (editCcy === "COP" || editCcy === "MXN" ? String(Math.round(amountInCcy)) : amountInCcy.toFixed(2)) : "",
      purchase_date: editing?.purchase_date ?? new Date().toISOString().slice(0, 10),
    });
    setViewCurrency(baseCurrency === "USD" ? "COP" : "USD");
  }, [open, editing, defaultType, baseCurrency, rates]);

  // Compute USD and converted view-currency from the typed amount + chosen input currency
  const amountNum = Number(form.amount) || 0;
  const amountUsd = amountNum / (rates[form.currency] || 1);
  const amountInView = amountUsd * (rates[viewCurrency] || 1);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const payload = {
        user_id: u.user.id,
        // Built-in enum types only persisted as enum; custom types are recorded in name/ticker
        asset_type: (allowedTypes.some((a) => a.value === form.asset_type) ? form.asset_type : defaultType) as AssetType,
        ticker: (forceCustomTicker ?? (form.name.trim().slice(0, 8) || form.asset_type)).toUpperCase().slice(0, 8),
        name: form.name.trim() || form.asset_type,
        platform: form.platform.trim() || null,
        currency: form.currency,
        purchase_date: form.purchase_date,
        quantity: 1,
        avg_cost_usd: amountUsd,
        current_price_usd: amountUsd, // current = invested (we removed live current value)
      };
      if (editing) {
        const { error } = await supabase.from("investments").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("investments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("saved"));
      qc.invalidateQueries({ queryKey: ["investments"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? t("error")),
  });

  const typeOptions = [
    ...allowedTypes.map((o) => ({ value: o.value as string, label: o.label })),
    ...customTypes.map((c) => ({ value: c, label: c })),
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? t("editAsset") : t("addAsset")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>{t("type")}</Label>
            <Select value={form.asset_type} onValueChange={(v) => setForm({ ...form, asset_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {typeOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label>{t("assetName")}</Label>
            <Input
              list="known-asset-names"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Apple, S&P 500, Bitcoin..."
            />
            <datalist id="known-asset-names">
              {knownNames.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>

          <div className="col-span-1">
            <Label>{t("platform")}</Label>
            <Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="Insight, Buda, Trii..." />
          </div>
          <div className="col-span-1">
            <Label className="flex items-center gap-1"><CalendarIcon className="size-3.5" /> {t("purchaseDate")}</Label>
            <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
          </div>

          {/* INVESTED AMOUNT + currency selector */}
          <div className="col-span-2 space-y-2 rounded-lg border border-border p-3 bg-muted/20">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("avgCost")}</Label>
            <div className="grid grid-cols-[1fr_110px] gap-2">
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
              />
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v as Currency })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Conversion result */}
            <div className="flex items-center justify-between rounded-md bg-background/60 p-2 mt-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground text-xs">{t("convertedTo")}</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
                <span className="font-mono font-semibold">{fmtCurrency(amountInView, viewCurrency)}</span>
              </div>
              <Select value={viewCurrency} onValueChange={(v) => setViewCurrency(v as Currency)}>
                <SelectTrigger className="w-[100px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.filter((c) => c !== form.currency).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              ≈ {fmtUSD(amountUsd)} USD · 1 USD = {fmtNum(rates.COP, 0)} COP
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.amount}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
