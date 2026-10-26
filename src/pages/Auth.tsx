import { useState, type FormEvent } from "react";
import { useT } from "../i18n";
import { errMsg, supabase } from "../lib/supabase";
import { useSession } from "../lib/session";
import { Field } from "../components/ui";

function AuthShell({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang } = useT();
  return (
    <div className="auth">
      <div className="auth-art">
        <div className="brand">
          <span className="brand-mark">კ</span>
          <span><b>{t("app.name")}</b><small>{t("app.tagline")}</small></span>
        </div>
        <div>
          <h2>{t("auth.hero")}</h2>
          <ul>
            <li>{t("auth.f1")}</li>
            <li>{t("auth.f2")}</li>
            <li>{t("auth.f3")}</li>
            <li>{t("auth.f4")}</li>
          </ul>
        </div>
        <small style={{ color: "var(--side-fg)", position: "relative", zIndex: 1 }}>© {new Date().getFullYear()} {t("app.name")}</small>
      </div>
      <div className="auth-form">
        <div style={{ position: "absolute", top: 16, right: 16 }}>
          <button className="btn ghost sm" onClick={() => setLang(lang === "ka" ? "en" : "ka")}>{lang === "ka" ? "English" : "ქართული"}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Login() {
  const { t } = useT();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "up") {
        if (password.length < 8) throw new Error(t("auth.pwShort"));
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setMsg(t("auth.checkEmail"));
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
        if (error) throw error;
        setMsg(t("auth.resetSent"));
      }
    } catch (e) {
      const m = errMsg(e);
      setErr(m.includes("Invalid login") ? t("auth.invalid") : m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={submit}>
        <div>
          <h1>{mode === "in" ? t("auth.signin") : mode === "up" ? t("auth.signup") : t("auth.forgot")}</h1>
          <p className="muted" style={{ marginTop: 6 }}>{mode === "up" ? t("auth.signupHint") : mode === "forgot" ? t("auth.forgotHint") : t("auth.signinHint")}</p>
        </div>
        <Field label={t("auth.email")}>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {mode !== "forgot" && (
          <Field label={t("auth.password")} hint={mode === "up" ? t("auth.pwHint") : undefined}>
            <input type="password" autoComplete={mode === "up" ? "new-password" : "current-password"} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        {err && <p className="error">{err}</p>}
        {msg && <p className="notice info">{msg}</p>}
        <button className="btn primary" disabled={busy} style={{ padding: "10px" }}>
          {mode === "in" ? t("auth.signin") : mode === "up" ? t("auth.create") : t("auth.sendLink")}
        </button>
        <div className="row between small">
          {mode === "in" ? (
            <>
              <button type="button" className="btn ghost sm" onClick={() => setMode("forgot")}>{t("auth.forgot")}</button>
              <button type="button" className="btn ghost sm" onClick={() => setMode("up")}>{t("auth.noAccount")}</button>
            </>
          ) : (
            <button type="button" className="btn ghost sm" onClick={() => setMode("in")}>← {t("auth.backToSignin")}</button>
          )}
        </div>
      </form>
    </AuthShell>
  );
}

export function ResetPassword() {
  const { t } = useT();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (pw.length < 8) return setErr(t("auth.pwShort"));
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setErr(error.message);
    setDone(true);
  }
  return (
    <AuthShell>
      <form onSubmit={submit}>
        <h1>{t("auth.newPassword")}</h1>
        {done ? (
          <>
            <p className="notice info">{t("auth.pwChanged")}</p>
            <a className="btn primary" href="/">{t("auth.continue")}</a>
          </>
        ) : (
          <>
            <Field label={t("auth.password")} hint={t("auth.pwHint")}>
              <input type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
            </Field>
            {err && <p className="error">{err}</p>}
            <button className="btn primary">{t("common.save")}</button>
          </>
        )}
      </form>
    </AuthShell>
  );
}

export function NotLinked() {
  const { t } = useT();
  const { session, signOut, reload } = useSession();
  return (
    <AuthShell>
      <div className="stack" style={{ width: "min(400px, 100%)" }}>
        <h1>{t("auth.notLinked")}</h1>
        <p className="muted">{t("auth.notLinkedText", { email: session?.user.email ?? "" })}</p>
        <div className="row">
          <button className="btn primary" onClick={reload}>{t("auth.checkAgain")}</button>
          <button className="btn" onClick={signOut}>{t("auth.signout")}</button>
        </div>
      </div>
    </AuthShell>
  );
}

export function SetupNeeded() {
  return (
    <div className="center" style={{ padding: 24 }}>
      <div className="card card-body stack" style={{ maxWidth: 560 }}>
        <h1>კადრი — დაყენება</h1>
        <p>აპლიკაციას ჯერ არ აქვს მითითებული Supabase-ის მონაცემები. დაამატეთ გარემოს ცვლადები <code>VITE_SUPABASE_URL</code> და <code>VITE_SUPABASE_ANON_KEY</code> (იხ. README) და ხელახლა გაუშვით.</p>
        <p className="muted">Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see README) and redeploy.</p>
      </div>
    </div>
  );
}
