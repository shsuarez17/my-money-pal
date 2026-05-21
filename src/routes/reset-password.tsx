import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
  },
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t, lang } = useI18n();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    // Supabase automatically sets a temporary session from the recovery URL hash.
    // We listen for the PASSWORD_RECOVERY event to confirm the session is active.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // Also check if a session already exists (the event may have fired before listener attached)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (password.length < 6) {
      return toast.error(t("passwordTooShort"));
    }
    if (password !== confirmPassword) {
      return toast.error(t("passwordsDoNotMatch"));
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    setChanged(true);
    toast.success(t("passwordChanged"));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "var(--gradient-hero)" }} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-8 w-full max-w-md relative z-10">
        <h1 className="text-xl font-display font-bold mb-2">{t("resetPassword")}</h1>

        {changed ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {lang === "es"
                ? "Tu contraseña ha sido actualizada. Ahora puedes iniciar sesión."
                : "Your password has been updated. You can now log in."}
            </p>
            <Link to="/login" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground w-full">
              {t("login")}
            </Link>
          </div>
        ) : !ready ? (
          <p className="text-sm text-muted-foreground">
            {lang === "es"
              ? "Verificando enlace de recuperación…"
              : "Verifying recovery link…"}
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {lang === "es"
                ? "Crea una nueva contraseña para tu cuenta."
                : "Create a new password for your account."}
            </p>
            <div>
              <Label>{t("newPassword")}</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <Label>{t("confirmNewPassword")}</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <Button className="w-full" disabled={loading} onClick={handleSubmit}>
              {t("save")}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
