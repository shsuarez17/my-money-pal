import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, LineChart, Bitcoin, Target, Repeat, Settings, Plus, Pencil, Trash2, ArrowDownUp, RefreshCw, CalendarIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/guide")({
  component: GuidePage,
});

function GuidePage() {
  const { t, lang } = useI18n();

  const sections = lang === "es" ? [
    {
      icon: LayoutDashboard, title: "Dashboard",
      desc: "Vista global de tu portafolio: total en USD y COP, ganancia/pérdida, distribución y evolución en el tiempo.",
    },
    {
      icon: LineChart, title: "Acciones & ETF",
      desc: "Administra acciones de EEUU, Colombia, ETF y bonos. Registra precio de compra y valor actual.",
    },
    {
      icon: Bitcoin, title: "Cripto",
      desc: "Lleva el control de tus posiciones en Bitcoin, Ethereum y otras criptomonedas.",
    },
    {
      icon: Target, title: "Metas",
      desc: "Define objetivos de inversión con fecha y monto. Visualiza el progreso hacia cada meta.",
    },
    {
      icon: Repeat, title: "Aportes recurrentes",
      desc: "Programa aportes periódicos (semanal, quincenal o mensual) a tus activos para construir disciplina.",
    },
    {
      icon: Settings, title: "Ajustes",
      desc: "Cambia el idioma, moneda base y otras preferencias de tu cuenta.",
    },
  ] : [
    { icon: LayoutDashboard, title: "Dashboard", desc: "Global view of your portfolio: USD and COP totals, P&L, distribution and evolution over time." },
    { icon: LineChart, title: "Stocks & ETF", desc: "Manage US stocks, Colombian stocks, ETFs and bonds. Record buy price and current value." },
    { icon: Bitcoin, title: "Crypto", desc: "Track your positions in Bitcoin, Ethereum and other cryptocurrencies." },
    { icon: Target, title: "Goals", desc: "Set investment goals with date and amount. Visualize progress toward each goal." },
    { icon: Repeat, title: "Recurring", desc: "Schedule periodic contributions (weekly, biweekly, monthly) to build discipline." },
    { icon: Settings, title: "Settings", desc: "Change language, base currency and other account preferences." },
  ];

  const icons = lang === "es" ? [
    { icon: Plus, label: "Añadir", desc: "Crea un nuevo registro (activo, meta o aporte)." },
    { icon: Pencil, label: "Editar", desc: "Modifica un registro existente." },
    { icon: Trash2, label: "Eliminar", desc: "Borra el registro de forma permanente." },
    { icon: ArrowDownUp, label: "Invertir montos", desc: "Intercambia los valores de 'Monto invertido' y 'Valor actual'." },
    { icon: RefreshCw, label: "Actualizar precios", desc: "Trae precios en vivo desde CoinGecko (cripto) y Yahoo Finance (acciones)." },
    { icon: CalendarIcon, label: "Fecha de inversión", desc: "Registra el día de la compra para tener histórico en el tiempo." },
  ] : [
    { icon: Plus, label: "Add", desc: "Create a new entry (asset, goal or contribution)." },
    { icon: Pencil, label: "Edit", desc: "Modify an existing entry." },
    { icon: Trash2, label: "Delete", desc: "Permanently remove an entry." },
    { icon: ArrowDownUp, label: "Swap amounts", desc: "Swap the values of 'Amount invested' and 'Current value'." },
    { icon: RefreshCw, label: "Refresh prices", desc: "Pull live prices from CoinGecko (crypto) and Yahoo Finance (stocks)." },
    { icon: CalendarIcon, label: "Investment date", desc: "Record purchase day to keep historical tracking over time." },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl md:text-4xl font-display font-bold">{lang === "es" ? "Guía de la app" : "App guide"}</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          {lang === "es"
            ? "Bienvenido a tu plataforma de seguimiento de inversiones. Aquí encontrarás qué hace cada sección y qué significa cada icono."
            : "Welcome to your investment tracking platform. Here's what each section does and what every icon means."}
        </p>
      </header>

      <section>
        <h2 className="text-xl font-display font-semibold mb-3">{lang === "es" ? "Secciones" : "Sections"}</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {sections.map((s) => (
            <div key={s.title} className="card-surface p-4 flex gap-3">
              <div className="size-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <s.icon className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-display font-semibold mb-3">{lang === "es" ? "Iconos y acciones" : "Icons & actions"}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {icons.map((i) => (
            <div key={i.label} className="card-surface p-4 flex gap-3 items-start">
              <div className="size-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                <i.icon className="size-4" />
              </div>
              <div>
                <div className="font-semibold text-sm">{i.label}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{i.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card-surface p-5">
        <h2 className="text-xl font-display font-semibold mb-2">{lang === "es" ? "Cómo añadir tu primer activo" : "How to add your first asset"}</h2>
        <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
          {(lang === "es" ? [
            "Ve a 'Acciones & ETF' o 'Cripto' según el tipo de activo.",
            "Pulsa 'Añadir activo' y selecciona el tipo (acción, ETF, bono, cripto).",
            "Escribe el nombre, plataforma y fecha de compra.",
            "Elige la moneda en la que invertiste (USD, COP, EUR, MXN, BRL).",
            "Ingresa el monto invertido y el valor actual. Verás la conversión a USD en vivo.",
            "Pulsa la flecha doble para intercambiar montos si los registraste invertidos.",
            "Guarda y revisa tu dashboard para ver el impacto en el total.",
          ] : [
            "Go to 'Stocks & ETF' or 'Crypto' depending on the asset.",
            "Click 'Add asset' and pick the type (stock, ETF, bond, crypto).",
            "Enter name, platform and purchase date.",
            "Choose the currency you invested in (USD, COP, EUR, MXN, BRL).",
            "Enter amount invested and current value. You'll see the live USD conversion.",
            "Press the double arrow to swap amounts if you entered them reversed.",
            "Save and check your dashboard to see the impact on your total.",
          ]).map((step) => <li key={step}>{step}</li>)}
        </ol>
      </section>
    </div>
  );
}

