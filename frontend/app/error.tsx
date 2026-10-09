"use client";
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="error-page"><h1>We couldn’t load this page.</h1><p>Please try again. If the problem continues, contact your campus administrator.</p><button onClick={reset}>Try again</button></main>;}
