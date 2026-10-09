"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { roleLabels, roleSchema, type Role } from "@/lib/types";
import { CampusArt, Logo } from "./visuals";

export default function Login({ role, demo }: { role: Role; demo: boolean }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function signIn() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          identifier: demo ? "demo" : identifier,
          password: demo ? "demo" : password,
          demo,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.push("/portal");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (demo) {
      setMessage(
        "Sample accounts do not need a password. Agree to the terms and open the demo.",
      );
      return;
    }
    if (identifier.length < 3) {
      setMessage("Enter your roll number or email first.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, student: role === "student" }),
      });
      const result = await response.json();
      setMessage(result.message ?? result.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-illustration">
        <Link href="/" className="back-link">
          <ArrowLeft size={17} />
          Back to campus
        </Link>
        <div>
          <span className="eyebrow">A BETTER CONNECTED CAMPUS</span>
          <h1>
            Every class.
            <br />A place to belong.
          </h1>
          <p>
            Your timetable, your classrooms,
            <br />
            your campus. All in one place.
          </p>
        </div>
        <CampusArt />
        <p className="illustration-foot">
          13 academic blocks · one connected campus
        </p>
      </section>
      <section className="login-form-area">
        <div className="login-card">
          <Logo />
          <h2>PSG College of Technology</h2>
          <p className="institution-subtitle">Smart Campus Room Management</p>
          <h1>{roleLabels[role]} Login</h1>
          <p className="muted">Welcome back. Your campus workspace awaits.</p>
          {demo && (
            <p className="demo-strip">
              Interactive preview · Sample accounts and records
            </p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void signIn();
            }}
          >
            <label className="line-field">
              {role === "student" ? "Roll no" : "Email"}
              <span>
                {role === "student" ? (
                  <GraduationCap size={20} />
                ) : (
                  <Mail size={20} />
                )}
                <input
                  type={role === "student" ? "text" : "email"}
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  autoComplete="username"
                  required={!demo}
                  placeholder={
                    demo
                      ? "Sample account — no credentials needed"
                      : role === "student"
                        ? "23Z001"
                        : "name@psgtech.ac.in"
                  }
                />
              </span>
            </label>
            <label className="line-field">
              Password
              <span>
                <LockKeyhole size={18} />
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required={!demo}
                  placeholder={
                    demo ? "Use the demo button below" : "Enter your password"
                  }
                />
                <button
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            <button
              className="forgot-password"
              type="button"
              disabled={busy}
              onClick={() => void reset()}
            >
              Forgot Password?
            </button>
            <p className="security-note">
              Live accounts lock for 15 minutes after 5 consecutive incorrect
              attempts.
            </p>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              <span>
                I agree to the{" "}
                <button
                  className="text-link"
                  type="button"
                  onClick={() => setTerms(true)}
                >
                  Terms &amp; Conditions
                </button>
              </span>
            </label>
            <button className="primary full-width" disabled={!agreed || busy}>
              {busy
                ? "Opening your workspace…"
                : demo
                  ? "Open " + roleLabels[role] + " demo"
                  : "Login"}
            </button>
          </form>
          <p className="form-message" role="status">
            {message}
          </p>
          <div className="or-divider">
            <i />
            OR
            <i />
          </div>
          <p className="portal-choice-label">Choose another portal</p>
          <div className="portal-choices">
            {roleSchema.options
              .filter((option) => option !== role)
              .map((option) => (
                <Link href={"/login/" + option} key={option}>
                  {roleLabels[option]}
                </Link>
              ))}
          </div>
          <p className="account-note">
            No public sign-up. Your administrator creates live accounts.
          </p>
        </div>
      </section>
      {terms && (
        <div className="modal">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="terms-title"
          >
            <h2 id="terms-title">Terms &amp; Conditions</h2>
            <p>
              This student-project preview uses sample campus records. Demo
              actions stay in your browser and do not reserve real college
              rooms. Use fictitious information and sample letters.
            </p>
            <button
              className="primary"
              onClick={() => {
                setAgreed(true);
                setTerms(false);
              }}
            >
              Agree and close
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
