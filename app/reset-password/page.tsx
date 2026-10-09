"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export default function Page() {
  const [tokens, setTokens] = useState({ access: "", refresh: "" }),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    setTokens({
      access: hash.get("access_token") ?? "",
      refresh: hash.get("refresh_token") ?? "",
    });
    window.history.replaceState(null, "", "/reset-password");
  }, []);
  return (
    <main className="message-page">
      <Link href="/login/student">Back to login</Link>
      <section className="panel">
        <h1>Reset your password</h1>
        <p className="muted">
          Open this page from the recovery link emailed to your registered
          address.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              const response = await fetch("/api/auth/password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...tokens, password }),
              });
              const result = await response.json();
              setMessage(
                result.error ?? "Password updated. Return to login to sign in.",
              );
            } catch {
              setMessage("Unable to update password. Try a new recovery link.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={256}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="primary" disabled={busy || !tokens.access}>
            Update password
          </button>
          <p role="status">
            {message ||
              (!tokens.access ? "A valid recovery link is required." : "")}
          </p>
        </form>
      </section>
    </main>
  );
}
