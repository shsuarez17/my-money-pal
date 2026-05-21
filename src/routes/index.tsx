import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, Bitcoin, LineChart, Target } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "var(--gradient-hero)" }} />
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg" style={{ backgroundImage: "var(--gradient-primary)" }} />
          <span className="font-display font-bold text-lg">{t("appName")}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(lang === "es" ? "en" : "es")} className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground">
            {lang === "es" ? "EN" : "ES"}
          </button>
          <Link to="/login"><Button variant="ghost" size="sm">{t("login")}</Button></Link>
          <Link to="/login"><Button size="sm">{t("getStarted")}</Button></Link>
        </div>
      </header>

      <main className="relative z-10 px-6 md:px-12 pt-12 md:pt-20 pb-20 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="inline-block px-3 py-1 rounded-full text-xs font-mono uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
            {t("tagline")}
          </span>
          <h1 className="mt-6 text-5xl md:text-7xl font-display font-bold leading-[0.95] tracking-tight max-w-4xl">
            {t("welcome").split(",")[0]},
            <br />
            <span className="gradient-text">{t("welcome").split(",")[1]?.trim() ?? ""}</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl">{t("welcomeSub")}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/login"><Button size="lg" className="glow-primary">{t("getStarted")} <ArrowRight className="ml-2 size-4" /></Button></Link>
          </div>
        </motion.div>

        <div className="mt-20 grid md:grid-cols-4 gap-4">
          {[
            { icon: BarChart3, label: t("dashboard"), desc: lang === "es" ? "Vista total al instante" : "Total view at a glance" },
            { icon: LineChart, label: t("stocks"), desc: lang === "es" ? "Precios en vivo de Yahoo Finance" : "Live prices from Yahoo Finance" },
            { icon: Bitcoin, label: t("crypto"), desc: lang === "es" ? "BTC, ETH, SOL y más" : "BTC, ETH, SOL and more" },
            { icon: Target, label: t("goals"), desc: lang === "es" ? "Define y mide tu progreso" : "Define and track progress" },
          ].map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i + 0.2 }}
              className="card-surface p-5"
            >
              <f.icon className="size-6 text-primary" />
              <div className="mt-3 font-semibold">{f.label}</div>
              <div className="text-sm text-muted-foreground mt-1">{f.desc}</div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
