import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "PSG Smart Campus",
  description:
    "A fresh Smart Campus Room Management System for PSG College of Technology.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
