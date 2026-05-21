import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// crypto symbol -> coingecko id
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin",
  ADA: "cardano", XRP: "ripple", DOGE: "dogecoin", MATIC: "matic-network",
  AVAX: "avalanche-2", DOT: "polkadot", LINK: "chainlink", LTC: "litecoin",
  USDT: "tether", USDC: "usd-coin", TRX: "tron", TON: "the-open-network",
};

async function fetchCryptoUSD(symbols: string[]): Promise<Record<string, number>> {
  const ids = symbols.map(s => COINGECKO_IDS[s.toUpperCase()]).filter(Boolean);
  if (!ids.length) return {};
  const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`);
  if (!r.ok) return {};
  const data = await r.json() as Record<string, { usd: number }>;
  const out: Record<string, number> = {};
  for (const sym of symbols) {
    const id = COINGECKO_IDS[sym.toUpperCase()];
    if (id && data[id]) out[sym.toUpperCase()] = data[id].usd;
  }
  return out;
}

async function fetchStockUSD(symbols: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(symbols.map(async (s) => {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=1d`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!r.ok) return;
      const j = await r.json() as any;
      const price = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (typeof price === "number") out[s.toUpperCase()] = price;
    } catch { /* ignore */ }
  }));
  return out;
}

async function fetchUsdCop(): Promise<number> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    if (r.ok) {
      const j = await r.json() as any;
      const rate = j?.rates?.COP;
      if (typeof rate === "number" && rate > 0) return rate;
    }
  } catch { /* ignore */ }
  // fallback
  return 4000;
}

export const refreshPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: holdings, error } = await supabase
      .from("investments")
      .select("id,ticker,asset_type")
      .eq("user_id", userId);
    if (error) throw error;

    const cryptoSyms = (holdings ?? []).filter(h => h.asset_type === "CRYPTO").map(h => h.ticker);
    const stockSyms = (holdings ?? []).filter(h => h.asset_type !== "CRYPTO").map(h => h.ticker);

    const [cryptoPrices, stockPrices, fx] = await Promise.all([
      cryptoSyms.length ? fetchCryptoUSD(cryptoSyms) : Promise.resolve({} as Record<string, number>),
      stockSyms.length ? fetchStockUSD(stockSyms) : Promise.resolve({} as Record<string, number>),
      fetchUsdCop(),
    ]);

    const all = { ...cryptoPrices, ...stockPrices };
    const now = new Date().toISOString();
    const updates: Promise<unknown>[] = [];
    for (const h of holdings ?? []) {
      const p = all[h.ticker.toUpperCase()];
      if (typeof p === "number") {
        updates.push(
          Promise.resolve(
            supabase.from("investments").update({
              current_price_usd: p, price_updated_at: now,
            }).eq("id", h.id)
          )
        );
      }
    }
    await Promise.all(updates);

    // cache fx (admin via authed client: RLS allows read; need service or skip)
    // We just return fx; saving uses admin path via separate fn if needed.
    return { updated: Object.keys(all).length, fx_usd_cop: fx };
  });

export const getFxUsdCop = createServerFn({ method: "GET" })
  .handler(async () => {
    return { rate: await fetchUsdCop() };
  });

export const searchTicker = createServerFn({ method: "POST" })
  .inputValidator((d: { query: string; type: "CRYPTO" | "STOCK" }) =>
    z.object({ query: z.string().min(1).max(20), type: z.enum(["CRYPTO", "STOCK"]) }).parse(d))
  .handler(async ({ data }) => {
    if (data.type === "CRYPTO") {
      const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(data.query)}`);
      if (!r.ok) return { results: [] };
      const j = await r.json() as any;
      return { results: (j?.coins ?? []).slice(0, 8).map((c: any) => ({ symbol: c.symbol?.toUpperCase(), name: c.name })) };
    }
    const r = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(data.query)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!r.ok) return { results: [] };
    const j = await r.json() as any;
    return { results: (j?.quotes ?? []).slice(0, 8).map((q: any) => ({ symbol: q.symbol, name: q.shortname ?? q.longname ?? q.symbol })) };
  });
