import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type Lang } from "@/lib/i18n";
import { useProfile, CURRENCIES, type Currency } from "@/lib/use-profile";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { user } = useAuth();
  const profileQ = useProfile();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState<Currency>("USD");
  const [types, setTypes] = useState<string[]>([]);
  const [newType, setNewType] = useState("");

  useEffect(() => {
    if (!profileQ.data) return;
    setName(profileQ.data.display_name ?? "");
    setBaseCurrency((profileQ.data.base_currency as Currency) ?? "USD");
    setTypes(profileQ.data.custom_asset_types ?? []);
  }, [profileQ.data]);

  const addType = () => {
    const v = newType.trim();
    if (!v || types.includes(v)) return;
    setTypes([...types, v]);
    setNewType("");
  };
  const removeType = (v: string) => setTypes(types.filter((x) => x !== v));

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      display_name: name,
      language: lang,
      base_currency: baseCurrency,
      custom_asset_types: types,
    }).eq("id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success(t("saved"));
      qc.invalidateQueries({ queryKey: ["profile"] });
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl md:text-4xl font-display font-bold">{t("settings")}</h1>
      <div className="card-surface p-6 space-y-4">
        <div><Label>{t("name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <Label>{t("language")}</Label>
          <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="es">Español</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("baseCurrency")}</Label>
          <Select value={baseCurrency} onValueChange={(v) => setBaseCurrency(v as Currency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>{t("customAssetTypes")}</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addType(); } }}
              placeholder={t("newTypePlaceholder")}
            />
            <Button type="button" variant="secondary" onClick={addType}><Plus className="size-4 mr-1" />{t("addType")}</Button>
          </div>
          {types.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {types.map((tp) => (
                <span key={tp} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm">
                  {tp}
                  <button type="button" onClick={() => removeType(tp)} className="text-muted-foreground hover:text-destructive">
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <Button onClick={save}>{t("save")}</Button>
      </div>
      <div className="card-surface p-6 text-sm text-muted-foreground">
        <p>{user?.email}</p>
      </div>
    </div>
  );
}
