import { createFileRoute } from "@tanstack/react-router";
import { AssetManager } from "@/components/asset-manager";
import { useI18n } from "@/lib/i18n";
import { SnapTradeConnect } from "@/components/snaptrade-connect";

export const Route = createFileRoute("/_authenticated/stocks")({ component: StocksPage });

function StocksPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <SnapTradeConnect />
      <AssetManager
        title={t("stocks")}
        defaultType="STOCK_US"
        allowedTypes={[
          { value: "STOCK_US", label: "Acciones EEUU" },
          { value: "STOCK_CO", label: "Acciones COL" },
          { value: "ETF", label: "ETF" },
          { value: "BOND", label: "Bonos" },
        ]}
        filterTypes={["STOCK_US", "STOCK_CO", "ETF", "BOND"]}
      />
    </div>
  );
}
