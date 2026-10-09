"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="message-page">
      <h1>We couldn’t load this page.</h1>
      <p>Try again, or return to your dashboard.</p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
