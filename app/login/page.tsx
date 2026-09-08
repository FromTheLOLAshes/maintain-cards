"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", { username, password, callbackUrl: "/", redirect: false });
    if (result?.error) { setError("Incorrect user ID or password."); setLoading(false); return; }
    window.location.assign(result?.url || "/");
  }

  return <main className="login-page"><form className="login-card" onSubmit={login}>
    <div className="login-mark">✦</div><p className="eyebrow">ARCANA CATALOG</p><h1>Welcome back</h1><p className="login-copy">Sign in to maintain your card collection.</p>
    <label className="field"><span>User ID</span><input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
    <label className="field"><span>Password</span><input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {error && <p className="login-error">{error}</p>}
    <button className="login-submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
  </form></main>;
}
