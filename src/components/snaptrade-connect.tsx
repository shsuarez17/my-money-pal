import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link2, RefreshCw, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  snaptradeStatus,
  snaptradeLoginUrl,
  snaptradeSync,
  snaptradeDisconnect,
} from "@/lib/snaptrade.functions";

export function SnapTradeConnect() {
  const qc = useQueryClient();
  const statusFn = useServerFn(snaptradeStatus);
  const loginFn = useServerFn(snaptradeLoginUrl);
  const syncFn = useServerFn(snaptradeSync);
  const discFn = useServerFn(snaptradeDisconnect);
  const [busy, setBusy] = useState<string | null>(null);

  const status = useQuery({ queryKey: ["snaptrade-status"], queryFn: () => statusFn() });

  const connect = useMutation({
    mutationFn: async () => loginFn(),
    onSuccess: (r) => {
      if (r?.redirectURI) {
        window.open(r.redirectURI, "_blank", "noopener,noreferrer");
        toast.success("Abriendo portal de conexión…");
        setTimeout(() => qc.invalidateQueries({ queryKey: ["snaptrade-status"] }), 1000);
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const sync = useMutation({
    mutationFn: async () => syncFn(),
    onSuccess: (r) => {
      toast.success(`Sincronizado: ${r.imported} posiciones de ${r.accounts} cuentas`);
      qc.invalidateQueries({ queryKey: ["investments"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const disc = useMutation({
    mutationFn: async () => discFn(),
    onSuccess: () => {
      toast.success("Desconectado");
      qc.invalidateQueries({ queryKey: ["snaptrade-status"] });
    },
  });

  const isConnected = status.data?.connected;

  return (
    <div className="card-surface p-4 flex items-center justify-between flex-wrap gap-3">
      <div>
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
          Conectar broker (SnapTrade)
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Conecta Interactive Brokers, Robinhood, Coinbase, Kraken, Binance, Webull y más para
          importar tus posiciones automáticamente.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {!isConnected ? (
          <Button onClick={() => { setBusy("c"); connect.mutate(undefined, { onSettled: () => setBusy(null) }); }}
                  disabled={connect.isPending}>
            <Link2 className="size-4 mr-1" />
            {connect.isPending ? "Generando enlace…" : "Conectar broker"}
          </Button>
        ) : (
          <>
            <Button onClick={() => connect.mutate()} variant="outline" disabled={connect.isPending}>
              <Link2 className="size-4 mr-1" /> Añadir otra cuenta
            </Button>
            <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
              <RefreshCw className={`size-4 mr-1 ${sync.isPending ? "animate-spin" : ""}`} />
              {sync.isPending ? "Sincronizando…" : "Sincronizar posiciones"}
            </Button>
            <Button onClick={() => { if (confirm("¿Desconectar SnapTrade?")) disc.mutate(); }}
                    variant="ghost" size="icon" title="Desconectar">
              <Unlink className="size-4 text-destructive" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}