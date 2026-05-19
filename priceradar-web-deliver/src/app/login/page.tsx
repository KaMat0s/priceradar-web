"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { Brandmark } from "@/components/Brandmark";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  function validate(): string | null {
    const e = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))
      return "Informe um e-mail válido (ex.: voce@email.com).";
    if (pass.length < 6)
      return "A senha precisa ter pelo menos 6 caracteres.";
    if (mode === "signup") {
      if (name.trim().length < 3)
        return "Informe seu nome completo (mínimo 3 caracteres).";
      if (!/[A-Za-z]/.test(pass) || !/[0-9]/.test(pass))
        return "Para mais segurança, use letras e números na senha.";
      if (pass !== pass2)
        return "As senhas não conferem. Digite a mesma senha nos dois campos.";
    }
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const err = validate();
    if (err) {
      setMsg({ t: err, ok: false });
      return;
    }

    if (!supabaseConfigured) {
      // Sem Supabase configurado → modo convidado (sessão local)
      sessionStorage.setItem("pr_guest", "1");
      sessionStorage.setItem("pr_name", name || email.split("@")[0] || "Convidado");
      router.push("/dashboard");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        setMsg({
          t: "Conta criada com sucesso! Verifique seu e-mail para confirmar e depois entre.",
          ok: true,
        });
        setMode("login");
        setPass("");
        setPass2("");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      setMsg({ t: err?.message || "Falha na autenticação.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      id="conteudo"
      className="min-h-screen flex items-center justify-center px-4 py-10"
    >
      <div className="w-full max-w-md">
        {/* marca */}
        <div className="mb-8">
          <Brandmark />
        </div>

        <div className="bg-surface border border-borderMid rounded-2xl p-6 sm:p-8 brand-glow animate-reveal">
          {/* tabs */}
          <div
            className="grid grid-cols-2 gap-1 p-1 bg-bg2 rounded-xl mb-6"
            role="tablist"
            aria-label="Modo de acesso"
          >
            {(["login", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setMsg(null);
                }}
                className={`py-2 rounded-lg font-ui font-semibold text-sm transition ${
                  mode === m
                    ? "bg-accent text-bg0"
                    : "text-textSecondary hover:text-textPrimary"
                }`}
              >
                {m === "login" ? "ENTRAR" : "CADASTRAR"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <p className="font-mono text-[11px] text-textTertiary -mt-1 mb-1">
              {mode === "login"
                ? "Acesse sua conta para ver sua watchlist e alertas."
                : "Crie sua conta gratuita para salvar produtos e receber alertas de preço."}
            </p>
            {mode === "signup" && (
              <Field
                id="name"
                label="Nome completo"
                value={name}
                onChange={setName}
                type="text"
                placeholder="Seu nome"
                required
              />
            )}
            <Field
              id="email"
              label="E-mail"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="voce@email.com"
              required
            />
            <Field
              id="pass"
              label="Senha"
              value={pass}
              onChange={setPass}
              type="password"
              placeholder="••••••••"
              required
              minLength={6}
            />
            {mode === "signup" && (
              <Field
                id="pass2"
                label="Confirmar senha"
                value={pass2}
                onChange={setPass2}
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
              />
            )}

            {msg && (
              <p
                role="status"
                className={`text-xs font-mono rounded-lg px-3 py-2 border ${
                  msg.ok
                    ? "text-accent border-accentDim bg-accentGhost"
                    : "text-danger border-danger/40 bg-danger/10"
                }`}
              >
                {msg.t}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-xl bg-accent text-bg0 font-ui font-bold tracking-wide hover:bg-accentHover transition disabled:opacity-50"
            >
              {busy
                ? "PROCESSANDO…"
                : mode === "login"
                ? "▸ ENTRAR"
                : "▸ CRIAR CONTA"}
            </button>
          </form>

          {!supabaseConfigured && (
            <p className="mt-5 text-[11px] font-mono text-textTertiary leading-relaxed border-t border-borderSubtle pt-4">
              ⚠ Supabase não configurado. O acesso entrará em{" "}
              <span className="text-warn">modo convidado</span>. Configure as
              variáveis em <code className="text-accent">.env.local</code> para
              habilitar login e banco remoto reais.
            </p>
          )}
        </div>

        <p className="text-center font-mono text-[11px] text-textQuat mt-6">
          © 2025 VYNTRIX · BUILD vy.3.0.0_web
        </p>
      </div>
    </main>
  );
}

function Field(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  placeholder: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div>
      <label
        htmlFor={props.id}
        className="block font-mono text-[11px] uppercase tracking-widest text-textTertiary mb-1.5"
      >
        {props.label}
      </label>
      <input
        id={props.id}
        type={props.type}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        required={props.required}
        minLength={props.minLength}
        autoComplete={props.type === "password" ? "current-password" : props.id}
        className="w-full bg-bg2 border border-borderMid rounded-xl px-4 py-3 text-textPrimary font-ui placeholder:text-textQuat focus:border-accent outline-none transition"
      />
    </div>
  );
}
