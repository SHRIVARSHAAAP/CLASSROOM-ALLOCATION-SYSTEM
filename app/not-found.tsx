import Link from "next/link";
export default function NotFound() {
  return (
    <main className="message-page">
      <h1>This page isn’t in your portal.</h1>
      <p>Use your dashboard to access the pages available to your role.</p>
      <Link href="/portal" className="primary">
        Go to dashboard
      </Link>
    </main>
  );
}
