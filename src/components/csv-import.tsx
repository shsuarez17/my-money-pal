import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useUsdRates, type Currency } from "@/lib/use-profile";

type AssetType = Database["public"]["Enums"]["asset_type"];

/**
 * Parses CSV with header row. Accepts comma or semicolon separators.
 * Required headers (case-insensitive, flexible): ticker, name, quantity, avg_cost, currency, asset_type?, platform?, purchase_date?
 */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) if (row[k]) return row[k];
  return "";
}

function num(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

const TEMPLATE = `ticker,name,asset_type,quantity,avg_cost,currency,platform,purchase_date
AAPL,Apple Inc,STOCK_US,10,170.5,USD,Trii,2024-03-15
ECOPETROL,Ecopetrol,STOCK_CO,100,2350,COP,Bancolombia,2024-05-01
`;

export function CsvImport({
  allowedTypes,
  defaultType,
  defaultPlatform,
}: {
  allowedTypes: { value: AssetType; label: string }[];
  defaultType: AssetType;
  defaultPlatform?: string;
}) {
  const qc = useQueryClient();
  const ratesQ = useUsdRates();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [platform, setPlatform] = useState(defaultPlatform ?? "");
  const [fallbackType, setFallbackType] = useState<AssetType>(defaultType);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (f: File) => {
    const text = await f.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) return toast.error("CSV vacío o inválido");
    setRows(parsed);
    toast.success(`${parsed.length} filas detectadas`);
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-inversiones.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("No autenticado");
    const rates = ratesQ.data ?? { USD: 1, COP: 4000, EUR: 0.92, MXN: 18, BRL: 5 } as Record<Currency, number>;

    setBusy(true);
    const allowedSet = new Set(allowedTypes.map((a) => a.value));
    const payload = rows.map((r) => {
      const ticker = pick(r, ["ticker", "symbol", "simbolo", "símbolo"]).toUpperCase();
      const name = pick(r, ["name", "nombre"]) || ticker;
      const rawType = pick(r, ["asset_type", "tipo", "type"]).toUpperCase();
      const asset_type = (allowedSet.has(rawType as AssetType) ? rawType : fallbackType) as AssetType;
      const quantity = num(pick(r, ["quantity", "cantidad", "qty", "shares"]));
      const avgCost = num(pick(r, ["avg_cost", "price", "precio", "costo", "cost"]));
      const currency = (pick(r, ["currency", "moneda"]).toUpperCase() || "USD") as Currency;
      const rate = rates[currency] ?? 1;
      const avg_cost_usd = currency === "USD" ? avgCost : avgCost / rate;
      const purchase_date = pick(r, ["purchase_date", "fecha", "date"]) || new Date().toISOString().slice(0, 10);
      const plat = pick(r, ["platform", "plataforma", "broker"]) || platform || "Importado";

      return {
        user_id: u.user!.id,
        ticker,
        name,
        asset_type,
        quantity,
        avg_cost_usd,
        current_price_usd: avg_cost_usd,
        currency,
        platform: plat,
        purchase_date,
        source: "csv",
      };
    }).filter((p) => p.ticker && p.quantity > 0);

    if (payload.length === 0) {
      setBusy(false);
      return toast.error("Ninguna fila válida (revisa ticker y cantidad)");
    }

    const { error } = await supabase.from("investments").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${payload.length} inversiones importadas`);
    qc.invalidateQueries({ queryKey: ["investments"] });
    setRows([]);
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="size-4 mr-1" /> Importar CSV
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar desde CSV (LatAm y otros)</DialogTitle>
            <DialogDescription>
              Exporta tu portafolio desde Trii, Bancolombia, Insight, GBM, XP, BTG o cualquier app y súbelo aquí.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                <Download className="size-4 mr-1" /> Descargar plantilla
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="size-4 mr-1" /> Elegir archivo
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Plataforma (si no viene en CSV)</Label>
                <Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Ej: Trii, Bancolombia" />
              </div>
              <div>
                <Label className="text-xs">Tipo por defecto</Label>
                <Select value={fallbackType} onValueChange={(v) => setFallbackType(v as AssetType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {rows.length > 0 && (
              <div className="border border-border rounded-lg max-h-64 overflow-auto text-xs">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr>{Object.keys(rows[0]).map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        {Object.keys(rows[0]).map((h) => <td key={h} className="p-2">{r[h]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 20 && <p className="p-2 text-muted-foreground">… y {rows.length - 20} filas más</p>}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={doImport} disabled={busy || rows.length === 0}>
              {busy ? "Importando…" : `Importar ${rows.length || ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}