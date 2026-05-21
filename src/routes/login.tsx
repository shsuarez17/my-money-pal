import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    nav({ to: "/dashboard" });
  };

  const signUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password, options: { data: { display_name: name }, emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(lang === "es" ? "Cuenta creada" : "Account created");
    nav({ to: "/dashboard" });
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (r.error) toast.error(r.error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "var(--gradient-hero)" }} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-8 w-full max-w-md relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg" style={{ backgroundImage: "var(--gradient-primary)" }} />
            <span className="font-display font-bold">{t("appName")}</span>
          </div>
          <button onClick={() => setLang(lang === "es" ? "en" : "es")} className="text-xs font-mono text-muted-foreground">
            {lang === "es" ? "EN" : "ES"}
          </button>
        </div>

        <Tabs defaultValue="login">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="login">{t("login")}</TabsTrigger>
            <TabsTrigger value="signup">{t("signup")}</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="space-y-3 mt-4">
            <div><Label>{t("email")}</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>{t("password")}</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">{t("forgotPassword")}</Link>
            </div>
            <Button className="w-full" disabled={loading} onClick={signIn}>{t("login")}</Button>
          </TabsContent>
          <TabsContent value="signup" className="space-y-3 mt-4">
            <div><Label>{t("name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>{t("email")}</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>{t("password")}</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button className="w-full" disabled={loading} onClick={signUp}>{t("signup")}</Button>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-3 my-5 text-xs text-muted-foreground">
          <div className="h-px bg-border flex-1" /><span>{t("or")}</span><div className="h-px bg-border flex-1" />
        </div>
        <Button variant="outline" className="w-full" onClick={google}>{t("continueWithGoogle")}</Button>
      </motion.div>
    </div>
  );
}
