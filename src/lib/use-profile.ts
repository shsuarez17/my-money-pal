import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProfileData = {
  display_name: string | null;
  language: string;
  base_currency: string;
  custom_asset_types: string[];
};

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<ProfileData> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not authenticated");
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, language, base_currency, custom_asset_types")
        .eq("id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      return {
        display_name: data?.display_name ?? null,
        language: data?.language ?? "es",
        base_currency: data?.base_currency ?? "USD",
        custom_asset_types: (data?.custom_asset_types as string[] | null) ?? [],
      };
    },
  });
}

export const CURRENCIES = ["USD", "COP", "EUR", "MXN", "BRL"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function useUsdRates() {
  return useQuery({
    queryKey: ["usd-rates"],
    queryFn: async () => {
      const r = await fetch("https://open.er-api.com/v6/latest/USD");
      const j = r.ok ? await r.json() : {};
      const rates = (j?.rates ?? {}) as Record<string, number>;
      return {
        USD: 1,
        COP: rates.COP ?? 4000,
        EUR: rates.EUR ?? 0.92,
        MXN: rates.MXN ?? 18,
        BRL: rates.BRL ?? 5,
      } as Record<Currency, number>;
    },
    staleTime: 10 * 60_000,
  });
}
