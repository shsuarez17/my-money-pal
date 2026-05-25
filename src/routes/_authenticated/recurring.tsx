import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Play, Link2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import { fmtUSD } from "@/lib/format";
import { toast } from "sonner";

type Freq = Database["public"]["Enums"]["recur_freq"];
type Category = "CRYPTO" | "STOCK" | "NONE";
const STOCK_TYPES = ["STOCK_US", "STOCK_CO", "ETF", "BOND"] as const;

export const Route = createFileRoute("/_authenticated/recurring")({ component: RecurringPage });

function advanceDate(d: string, f: Freq): string {
  const dt = new Date(d + "T00:00:00");
  if (f === "WEEKLY") dt.setDate(dt.getDate() + 7);
  else if (f === "BIWEEKLY") dt.setDate(dt.getDate() + 14);
  else dt.setMonth(dt.getMonth() + 1);
  return dt.toISOString().slice(0, 10);
}

function RecurringPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [freq, setFreq] = useState<Freq>("MONTHLY");
  const [next, setNext] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<Category>("NONE");
  const [investmentId, setInvestmentId] = useState<string>("");
  const [goalId, setGoalId] = useState<string>("");

  const q = useQuery({
    queryKey: ["recurring"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recurring_contributions").select("*").order("next_run");
      if (error) throw error; return data ?? [];
    },
  });

  const investmentsQ = useQuery({
    queryKey: ["investments-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investments")
        .select("id, name, ticker, asset_type, current_price_usd, quantity, avg_cost_usd, currency")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const goalsQ = useQuery({
    queryKey: ["goals-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredInvestments = useMemo(() => {
    const list = investmentsQ.data ?? [];
    if (category === "CRYPTO") return list.filter((i: any) => i.asset_type === "CRYPTO");
    if (category === "STOCK") return list.filter((i: any) => STOCK_TYPES.includes(i.asset_type));
    return list;
  }, [investmentsQ.data, category]);

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        user_id: u.user!.id,
        amount_usd: Number(amount),
        frequency: freq,
        next_run: next,
        asset_category: category === "NONE" ? null : category,
        investment_id: investmentId || null,
        goal_id: goalId || null,
      };
      if (editingId) {
        const { user_id, ...upd } = payload;
        const { error } = await supabase.from("recurring_contributions").update(upd).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("recurring_contributions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring"] });
      setOpen(false);
      setEditingId(null);
      setAmount(""); setCategory("NONE"); setInvestmentId(""); setGoalId("");
      toast.success(t("saved"));
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("recurring_contributions").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("recurring_contributions").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] }),
  });

  // Execute a single recurring item (used both for auto-run and manual button)
  const executeOne = async (r: any): Promise<{ ok: boolean; msg?: string }> => {
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user!.id;
    const amountUsd = Number(r.amount_usd);

    // 1) Investment: add units at current price (weighted avg cost)
    if (r.investment_id) {
      const inv = (investmentsQ.data ?? []).find((i: any) => i.id === r.investment_id);
      if (!inv) return { ok: false, msg: "Activo no encontrado" };
      const price = Number(inv.current_price_usd);
      if (!price || price <= 0) return { ok: false, msg: `Sin precio actual para ${inv.name}` };
      const addedQty = amountUsd / price;
      const newQty = Number(inv.quantity) + addedQty;
      const newCostTotal = Number(inv.quantity) * Number(inv.avg_cost_usd) + amountUsd;
      const newAvg = newQty > 0 ? newCostTotal / newQty : Number(inv.avg_cost_usd);
      const { error } = await supabase
        .from("investments")
        .update({ quantity: newQty, avg_cost_usd: newAvg })
        .eq("id", inv.id);
      if (error) return { ok: false, msg: error.message };
    }

    // 2) Goal contribution
    if (r.goal_id) {
      const { error } = await supabase.from("goal_contributions" as any).insert({
        user_id: userId,
        goal_id: r.goal_id,
        amount_usd: amountUsd,
        currency: r.currency ?? "USD",
      });
      if (error) return { ok: false, msg: error.message };
    }

    // 3) Advance schedule
    const today = new Date().toISOString().slice(0, 10);
    let nextRun = advanceDate(r.next_run, r.frequency as Freq);
    while (nextRun <= today) nextRun = advanceDate(nextRun, r.frequency as Freq);
    const { error: upErr } = await supabase
      .from("recurring_contributions")
      .update({ next_run: nextRun, last_run: today } as any)
      .eq("id", r.id);
    if (upErr) return { ok: false, msg: upErr.message };

    return { ok: true };
  };

  const runNow = useMutation({
    mutationFn: async (r: any) => {
      const res = await executeOne(r);
      if (!res.ok) throw new Error(res.msg || "Error");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring"] });
      qc.invalidateQueries({ queryKey: ["investments"] });
      qc.invalidateQueries({ queryKey: ["investments-min"] });
      qc.invalidateQueries({ queryKey: ["goal_contributions"] });
      toast.success("Aporte ejecutado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  // Auto-run due items on mount (once per page load)
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    if (!q.data || !investmentsQ.data || !goalsQ.data) return;
    autoRan.current = true;
    const today = new Date().toISOString().slice(0, 10);
    const due = q.data.filter((r: any) => r.active && r.next_run <= today && (r.investment_id || r.goal_id));
    if (due.length === 0) return;
    (async () => {
      let okCount = 0;
      for (const r of due) {
        const res = await executeOne(r);
        if (res.ok) okCount++;
      }
      if (okCount > 0) {
        toast.success(`${okCount} aporte(s) ejecutado(s) automáticamente`);
        qc.invalidateQueries({ queryKey: ["recurring"] });
        qc.invalidateQueries({ queryKey: ["investments"] });
        qc.invalidateQueries({ queryKey: ["investments-min"] });
        qc.invalidateQueries({ queryKey: ["goal_contributions"] });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, investmentsQ.data, goalsQ.data]);

  const freqLabel = (f: Freq) => f === "WEEKLY" ? t("weekly") : f === "BIWEEKLY" ? t("biweekly") : t("monthly");

  const today = new Date().toISOString().slice(0, 10);
  const invName = (id: string | null) => (investmentsQ.data ?? []).find((i: any) => i.id === id)?.name;
  const goalName = (id: string | null) => (goalsQ.data ?? []).find((g: any) => g.id === id)?.name;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-3xl md:text-4xl font-display font-bold">{t("recurring")}</h1>
        <Button onClick={() => {
          setEditingId(null);
          setAmount(""); setFreq("MONTHLY"); setNext(new Date().toISOString().slice(0,10));
          setCategory("NONE"); setInvestmentId(""); setGoalId("");
          setOpen(true);
        }}><Plus className="size-4 mr-1" />{t("addRecurring")}</Button>
      </div>

      <div className="card-surface p-2 md:p-4">
        {(q.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 text-center">{t("noData")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">{t("amount")}</th>
                <th className="text-left">{t("frequency")}</th>
                <th className="text-left">{t("nextRun")}</th>
                <th className="text-left">Destino</th>
                <th></th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((r: any) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 font-semibold tabular">{fmtUSD(Number(r.amount_usd))}</td>
                  <td>{freqLabel(r.frequency)}</td>
                  <td className="font-mono">{r.next_run}</td>
                  <td className="text-xs">
                    <div className="flex flex-col gap-0.5">
                      {r.investment_id && (
                        <span className="inline-flex items-center gap-1"><Link2 className="size-3" />{invName(r.investment_id) ?? "—"}</span>
                      )}
                      {r.goal_id && (
                        <span className="inline-flex items-center gap-1 text-primary"><Link2 className="size-3" />Meta: {goalName(r.goal_id) ?? "—"}</span>
                      )}
                      {!r.investment_id && !r.goal_id && <span className="text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td><Switch checked={r.active} onCheckedChange={(v) => toggle.mutate({ id: r.id, active: v })} /></td>
                  <td>
                    {r.active && r.next_run <= today && (r.investment_id || r.goal_id) && (
                      <Button size="sm" variant="secondary" onClick={() => runNow.mutate(r)} disabled={runNow.isPending}>
                        <Play className="size-3 mr-1" />Ejecutar
                      </Button>
                    )}
                  </td>
                  <td className="text-right pr-3">
                    <div className="inline-flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => {
                        setEditingId(r.id);
                        setAmount(String(r.amount_usd));
                        setFreq(r.frequency as Freq);
                        setNext(r.next_run);
                        setCategory((r.asset_category as Category) ?? "NONE");
                        setInvestmentId(r.investment_id ?? "");
                        setGoalId(r.goal_id ?? "");
                        setOpen(true);
                      }}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar aporte recurrente" : t("addRecurring")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("amount")} (USD)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div>
              <Label>{t("frequency")}</Label>
              <Select value={freq} onValueChange={(v) => setFreq(v as Freq)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">{t("weekly")}</SelectItem>
                  <SelectItem value="BIWEEKLY">{t("biweekly")}</SelectItem>
                  <SelectItem value="MONTHLY">{t("monthly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("nextRun")}</Label><Input type="date" value={next} onChange={(e) => setNext(e.target.value)} /></div>

            <div className="border-t border-border pt-3 space-y-3">
              <div>
                <Label>Categoría de inversión</Label>
                <Select value={category} onValueChange={(v) => { setCategory(v as Category); setInvestmentId(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Ninguna (solo meta)</SelectItem>
                    <SelectItem value="CRYPTO">Criptomonedas</SelectItem>
                    <SelectItem value="STOCK">Acciones & ETF</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {category !== "NONE" && (
                <div>
                  <Label>Activo a aportar</Label>
                  <Select value={investmentId} onValueChange={setInvestmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder={filteredInvestments.length ? "Selecciona activo" : "No hay activos en esta categoría"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredInvestments.map((i: any) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name} ({i.ticker})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Al ejecutar el aporte, se sumarán unidades al activo según su precio actual.
                  </p>
                </div>
              )}

              <div>
                <Label>Enlazar con meta (opcional)</Label>
                <Select value={goalId || "__none"} onValueChange={(v) => setGoalId(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Ninguna</SelectItem>
                    {(goalsQ.data ?? []).map((g: any) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button
              onClick={() => add.mutate()}
              disabled={
                !amount || add.isPending ||
                (category !== "NONE" && !investmentId)
              }
            >{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
