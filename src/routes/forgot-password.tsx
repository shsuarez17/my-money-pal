import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t, lang } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success(t("resetLinkSent"));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "var(--gradient-hero)" }} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-8 w-full max-w-md relative z-10">
        <h1 className="text-xl font-display font-bold mb-2">{t("resetPassword")}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {sent
            ? t("resetLinkSent")
            : lang === "es"
              ? "Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña."
              : "Enter your email and we'll send you a link to reset your password."}
        </p>

        {!sent && (
          <div className="space-y-3">
            <div>
              <Label>{t("email")}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button className="w-full" disabled={loading} onClick={handleSubmit}>
              {t("sendResetLink")}
            </Button>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm text-primary hover:underline">
            {t("backToLogin")}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
