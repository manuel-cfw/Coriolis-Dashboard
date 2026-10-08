import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { Wordmark } from "./ui";

export function LoginView({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(email.trim(), password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="panel" onSubmit={submit}>
        <Wordmark style={compact ? { fontSize: 20 } : undefined} />
        <p className="eyebrow" style={{ textAlign: "center", margin: 0 }}>
          Crew-Dashboard für Owlbear Rodeo
        </p>
        <label className="field">
          <span>E-Mail</span>
          <input
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Passwort</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-gold" type="submit" disabled={busy}>
          {busy ? "Verbinde …" : "Anmelden"}
        </button>
        <p className="dim" style={{ textAlign: "center", margin: 0, fontSize: 11.5 }}>
          Login der Coriolis-App verwenden.
        </p>
      </form>
    </div>
  );
}
