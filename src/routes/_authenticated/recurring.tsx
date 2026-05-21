import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/recurring")({ component: RecurringPage });

function RecurringPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [freq, setFreq] = useState<Freq>("MONTHLY");
  const [next, setNext] = useState(new Date().toISOString().slice(0, 10));

  const q = useQuery({
    queryKey: ["recurring"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recurring_contributions").select("*").order("next_run");
      if (error) throw error; return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("recurring_contributions").insert({
        user_id: u.user!.id, amount_usd: Number(amount), frequency: freq, next_run: next,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recurring"] }); setOpen(false); setAmount(""); toast.success(t("saved")); },
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

  const freqLabel = (f: Freq) => f === "WEEKLY" ? t("weekly") : f === "BIWEEKLY" ? t("biweekly") : t("monthly");

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-3xl md:text-4xl font-display font-bold">{t("recurring")}</h1>
        <Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" />{t("addRecurring")}</Button>
      </div>

      <div className="card-surface p-2 md:p-4">
        {(q.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 text-center">{t("noData")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left p-3">{t("amount")}</th><th className="text-left">{t("frequency")}</th><th className="text-left">{t("nextRun")}</th><th></th><th></th></tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 font-semibold tabular">{fmtUSD(Number(r.amount_usd))}</td>
                  <td>{freqLabel(r.frequency)}</td>
                  <td className="font-mono">{r.next_run}</td>
                  <td><Switch checked={r.active} onCheckedChange={(v) => toggle.mutate({ id: r.id, active: v })} /></td>
                  <td className="text-right pr-3">
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("addRecurring")}</DialogTitle></DialogHeader>
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
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => add.mutate()} disabled={!amount || add.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
