import { createFileRoute } from "@tanstack/react-router";
import { AssetManager } from "@/components/asset-manager";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/crypto")({ component: CryptoPage });

function CryptoPage() {
  const { t } = useI18n();
  return (
    <AssetManager
      title={t("crypto")}
      defaultType="CRYPTO"
      allowedTypes={[{ value: "CRYPTO", label: "Crypto" }]}
      filterTypes={["CRYPTO"]}
    />
  );
}
