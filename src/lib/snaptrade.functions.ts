import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import crypto from "crypto";

const BASE = "https://api.snaptrade.com/api/v1";

function stringifyOrdered(obj: Record<string, unknown>): string {
  const keys: string[] = [];
  const seen = new Set<string>();
  JSON.stringify(obj, (k, v) => {
    if (!seen.has(k)) { seen.add(k); keys.push(k); }
    return v;
  });
  keys.sort();
  return JSON.stringify(obj, keys);
}

function sign(payload: object, consumerKey: string): string {
  return crypto.createHmac("sha256", consumerKey).update(stringifyOrdered(payload as any)).digest("base64");
}

async function snapRequest(
  method: "GET" | "POST" | "DELETE",
  path: string,
  query: Record<string, string> = {},
  body?: object,
) {
  const clientId = process.env.SNAPTRADE_CLIENT_ID;
  const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;
  if (!clientId) throw new Error("SNAPTRADE_CLIENT_ID is not configured");
  if (!consumerKey) throw new Error("SNAPTRADE_CONSUMER_KEY is not configured");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const fullQuery = { ...query, clientId, timestamp };
  const qs = Object.entries(fullQuery).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const fullPath = `/api/v1${path}`;
  const signature = sign(
    { content: body ?? "", path: fullPath, query: qs },
    consumerKey,
  );
  const res = await fetch(`${BASE}${path}?${qs}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Signature: signature,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SnapTrade ${method} ${path} failed [${res.status}]: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function getOrCreateSnapUser(userId: string) {
  const { data: existing } = await supabaseAdmin
    .from("snaptrade_users").select("*").eq("user_id", userId).maybeSingle();
  if (existing) return existing;

  const snapUserId = `lov_${userId}`;
  const reg = await snapRequest("POST", "/snapTrade/registerUser", {}, { userId: snapUserId });
  const row = {
    user_id: userId,
    snaptrade_user_id: reg.userId as string,
    user_secret: reg.userSecret as string,
  };
  const { error } = await supabaseAdmin.from("snaptrade_users").insert(row);
  if (error) throw error;
  return row as any;
}

export const snaptradeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("snaptrade_users").select("snaptrade_user_id").eq("user_id", context.userId).maybeSingle();
    return { connected: !!data };
  });

export const snaptradeLoginUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const user = await getOrCreateSnapUser(context.userId);
    const r = await snapRequest("POST", "/snapTrade/login", {
      userId: user.snaptrade_user_id,
      userSecret: user.user_secret,
    }, { connectionType: "read" });
    return { redirectURI: r.redirectURI as string };
  });

export const snaptradeSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: snap } = await supabaseAdmin
      .from("snaptrade_users").select("*").eq("user_id", userId).maybeSingle();
    if (!snap) throw new Error("SnapTrade no conectado");

    const accounts = await snapRequest("GET", "/accounts", {
      userId: snap.snaptrade_user_id,
      userSecret: snap.user_secret,
    }) as any[];

    let imported = 0;
    for (const acct of accounts) {
      const brokerName = acct?.institution_name || acct?.brokerage_authorization?.brokerage?.name || "Broker";
      const positions = await snapRequest("GET", `/accounts/${acct.id}/positions`, {
        userId: snap.snaptrade_user_id,
        userSecret: snap.user_secret,
      }) as any[];

      for (const p of positions) {
        const sym = p?.symbol?.symbol ?? p?.symbol ?? {};
        const ticker = (sym?.symbol ?? sym?.raw_symbol ?? "").toString().toUpperCase().slice(0, 8);
        const name = sym?.description ?? sym?.symbol ?? ticker;
        const qty = Number(p?.units ?? 0);
        const price = Number(p?.price ?? p?.last_ask_price ?? 0);
        if (!ticker || !qty) continue;
        const currency = (sym?.currency?.code ?? "USD").toUpperCase();
        const externalId = `${acct.id}:${ticker}`;

        const payload = {
          user_id: userId,
          asset_type: (ticker.length <= 5 ? "STOCK_US" : "ETF") as "STOCK_US" | "ETF",
          ticker,
          name,
          platform: `SnapTrade · ${brokerName}`,
          quantity: qty,
          avg_cost_usd: price,
          current_price_usd: price,
          price_updated_at: new Date().toISOString(),
          currency,
          source: "snaptrade",
          external_id: externalId,
        };
        const { error } = await supabase.from("investments")
          .upsert(payload, { onConflict: "user_id,source,external_id" });
        if (!error) imported += 1;
      }
    }
    return { imported, accounts: accounts.length };
  });

export const snaptradeDisconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: snap } = await supabaseAdmin
      .from("snaptrade_users").select("*").eq("user_id", context.userId).maybeSingle();
    if (snap) {
      try {
        await snapRequest("DELETE", "/snapTrade/deleteUser", {
          userId: snap.snaptrade_user_id,
          userSecret: snap.user_secret,
        });
      } catch {}
      await supabaseAdmin.from("snaptrade_users").delete().eq("user_id", context.userId);
    }
    return { ok: true };
  });