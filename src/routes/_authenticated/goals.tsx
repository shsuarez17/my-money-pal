import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, PiggyBank, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { fmtCurrency } from "@/lib/format";
import { CURRENCIES, type Currency, useUsdRates } from "@/lib/use-profile";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/goals")({ component: GoalsPage });

function weeksBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return 0;
  return Math.round(ms / (7 * 24 * 60 * 60 * 1000));
}

function GoalsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const ratesQ = useUsdRates();
  const rates = ratesQ.data ?? { USD: 1, COP: 4000, EUR: 0.92, MXN: 18, BRL: 5 };

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Contribution dialog state
  const [contribOpen, setContribOpen] = useState(false);
  const [contribGoalId, setContribGoalId] = useState<string | null>(null);
  const [contribGoalCcy, setContribGoalCcy] = useState<Currency>("USD");
  const [contribAmount, setContribAmount] = useState("");
  const [contribCurrency, setContribCurrency] = useState<Currency>("USD");

  const goalsQ = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").order("created_at");
      if (error) throw error; return data ?? [];
    },
  });

  const contribsQ = useQuery({
    queryKey: ["goal_contributions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goal_contributions" as any)
        .select("*")
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown) as Array<{
        id: string; goal_id: string; amount_usd: number; currency: string; occurred_at: string;
      }>;
    },
  });

  const totalsByGoal = new Map<string, number>();
  for (const c of contribsQ.data ?? []) {
    totalsByGoal.set(c.goal_id, (totalsByGoal.get(c.goal_id) ?? 0) + Number(c.amount_usd));
  }

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const targetNum = Number(target);
      const targetUsd = currency === "USD" ? targetNum : targetNum / (rates[currency] || 1);
      if (editingId) {
        const { error } = await supabase.from("goals").update({
          name: name.trim(),
          target_amount_usd: targetUsd,
          currency,
          start_date: startDate || null,
          target_date: endDate || null,
        }).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("goals").insert({
          user_id: u.user!.id,
          name: name.trim(),
          target_amount_usd: targetUsd,
          currency,
          start_date: startDate || null,
          target_date: endDate || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      setOpen(false);
      setEditingId(null);
      setName(""); setTarget(""); setStartDate(""); setEndDate(""); setCurrency("USD");
      toast.success(t("saved"));
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("goals").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const addContrib = useMutation({
    mutationFn: async () => {
      if (!contribGoalId) throw new Error("missing goal");
      const { data: u } = await supabase.auth.getUser();
      const amt = Number(contribAmount);
      if (!amt) throw new Error("invalid amount");
      const amountUsd = contribCurrency === "USD" ? amt : amt / (rates[contribCurrency] || 1);
      const { error } = await supabase.from("goal_contributions" as any).insert({
        user_id: u.user!.id,
        goal_id: contribGoalId,
        amount_usd: amountUsd,
        currency: contribCurrency,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goal_contributions"] });
      setContribOpen(false);
      setContribAmount("");
      toast.success(t("saved"));
    },
    onError: (e: any) => toast.error(e?.message ?? t("error")),
  });

  const delContrib = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goal_contributions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goal_contributions"] }),
  });

  const previewWeeks = weeksBetween(startDate, endDate);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-3xl md:text-4xl font-display font-bold">{t("goals")}</h1>
        <Button onClick={() => {
          setEditingId(null);
          setName(""); setTarget(""); setStartDate(""); setEndDate(""); setCurrency("USD");
          setOpen(true);
        }}><Plus className="size-4 mr-1" />{t("addGoal")}</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {(goalsQ.data ?? []).length === 0 && (
          <div className="card-surface p-6 text-sm text-muted-foreground md:col-span-2">{t("noData")}</div>
        )}
        {(goalsQ.data ?? []).map((g) => {
          const goalCcy = (g.currency as Currency) ?? "USD";
          const r = rates[goalCcy] || 1;
          const targetUsd = Number(g.target_amount_usd);
          const targetInCcy = targetUsd * r;
          const accumulatedUsd = totalsByGoal.get(g.id) ?? 0;
          const accumulatedInCcy = accumulatedUsd * r;
          const pct = targetUsd > 0 ? accumulatedUsd / targetUsd : 0;
          const wk = weeksBetween(g.start_date, g.target_date);
          const myContribs = (contribsQ.data ?? []).filter((c) => c.goal_id === g.id);
          const over = pct > 1;
          return (
            <div key={g.id} className="card-surface p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{g.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {g.start_date ?? "—"} → {g.target_date ?? "—"}
                    {wk > 0 && <span className="ml-2 font-mono">· {wk} {t("weeks")}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="secondary" onClick={() => {
                    setContribGoalId(g.id);
                    setContribGoalCcy(goalCcy);
                    setContribCurrency(goalCcy);
                    setContribAmount("");
                    setContribOpen(true);
                  }}>
                    <PiggyBank className="size-4 mr-1" /> {t("addContribution")}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => {
                    setEditingId(g.id);
                    setName(g.name);
                    setCurrency(goalCcy);
                    setTarget(String((Number(g.target_amount_usd) * r).toFixed(2)));
                    setStartDate(g.start_date ?? "");
                    setEndDate(g.target_date ?? "");
                    setOpen(true);
                  }}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(g.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">{t("progress")}</span>
                  <span className="font-mono tabular">{fmtCurrency(accumulatedInCcy, goalCcy)} / {fmtCurrency(targetInCcy, goalCcy)}</span>
                </div>
                <Progress value={Math.min(100, pct * 100)} />
                <p className={`text-right text-xs mt-1 font-mono ${over ? "text-success font-semibold" : "text-muted-foreground"}`}>
                  {(pct * 100).toFixed(1)}% {over && `· ${t("overflow")}`}
                </p>
              </div>

              {myContribs.length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs uppercase tracking-wider font-mono text-muted-foreground mb-2">{t("contributions")}</p>
                  <ul className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {myContribs.map((c) => (
                      <li key={c.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{new Date(c.occurred_at).toLocaleDateString()}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{fmtCurrency(Number(c.amount_usd) * r, goalCcy)}</span>
                          <button onClick={() => delContrib.mutate(c.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add goal dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar meta" : t("addGoal")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("goalName")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <div>
                <Label>{t("target")}</Label>
                <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
              </div>
              <div>
                <Label>{t("currency")}</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t("startDate")}</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div><Label>{t("endDate")}</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            </div>
            {previewWeeks > 0 && (
              <div className="text-xs font-mono text-muted-foreground">
                = {previewWeeks} {t("weeks")}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => add.mutate()} disabled={!name || !target || add.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contribution dialog */}
      <Dialog open={contribOpen} onOpenChange={setContribOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("addContribution")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <div>
                <Label>{t("contributionAmount")}</Label>
                <Input type="number" inputMode="decimal" step="any" value={contribAmount} onChange={(e) => setContribAmount(e.target.value)} />
              </div>
              <div>
                <Label>{t("currency")}</Label>
                <Select value={contribCurrency} onValueChange={(v) => setContribCurrency(v as Currency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {contribAmount && (
              <div className="text-xs font-mono text-muted-foreground">
                ≈ {fmtCurrency(
                  (Number(contribAmount) / (rates[contribCurrency] || 1)) * (rates[contribGoalCcy] || 1),
                  contribGoalCcy
                )} ({contribGoalCcy})
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setContribOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => addContrib.mutate()} disabled={!contribAmount || addContrib.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
