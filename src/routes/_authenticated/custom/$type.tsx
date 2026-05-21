import { createFileRoute } from "@tanstack/react-router";
import { AssetManager } from "@/components/asset-manager";

export const Route = createFileRoute("/_authenticated/custom/$type")({
  component: CustomSheetPage,
});

function CustomSheetPage() {
  const { type } = Route.useParams();
  const decoded = decodeURIComponent(type);
  return (
    <AssetManager
      title={decoded}
      defaultType="STOCK_US"
      allowedTypes={[{ value: "STOCK_US", label: decoded }]}
      filterTypes={[]}
      customTypeName={decoded}
    />
  );
}
