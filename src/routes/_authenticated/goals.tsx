import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
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
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const goalsQ = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").order("created_at");
      if (error) throw error; return data ?? [];
    },
  });

  const invQ = useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      const { data } = await supabase.from("investments").select("quantity,current_price_usd");
      return data ?? [];
    },
  });

  const totalUsd = (invQ.data ?? []).reduce((a, h) => a + Number(h.quantity) * Number(h.current_price_usd), 0);

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const targetNum = Number(target);
      const targetUsd = currency === "USD" ? targetNum : targetNum / (rates[currency] || 1);
      const { error } = await supabase.from("goals").insert({
        user_id: u.user!.id,
        name: name.trim(),
        target_amount_usd: targetUsd,
        currency,
        start_date: startDate || null,
        target_date: endDate || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      setOpen(false);
      setName(""); setTarget(""); setStartDate(""); setEndDate(""); setCurrency("USD");
      toast.success(t("saved"));
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("goals").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const previewWeeks = weeksBetween(startDate, endDate);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-3xl md:text-4xl font-display font-bold">{t("goals")}</h1>
        <Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" />{t("addGoal")}</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {(goalsQ.data ?? []).length === 0 && (
          <div className="card-surface p-6 text-sm text-muted-foreground md:col-span-2">{t("noData")}</div>
        )}
        {(goalsQ.data ?? []).map((g) => {
          const goalCcy = (g.currency as Currency) ?? "USD";
          const targetInCcy = Number(g.target_amount_usd) * (rates[goalCcy] || 1);
          const totalInCcy = totalUsd * (rates[goalCcy] || 1);
          const pct = Math.min(1, totalUsd / Number(g.target_amount_usd));
          const wk = weeksBetween(g.start_date, g.target_date);
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
                <Button size="icon" variant="ghost" onClick={() => del.mutate(g.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">{t("progress")}</span>
                  <span className="font-mono tabular">{fmtCurrency(totalInCcy, goalCcy)} / {fmtCurrency(targetInCcy, goalCcy)}</span>
                </div>
                <Progress value={pct * 100} />
                <p className="text-right text-xs text-muted-foreground mt-1 font-mono">{(pct * 100).toFixed(1)}%</p>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("addGoal")}</DialogTitle></DialogHeader>
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
    </div>
  );
}
