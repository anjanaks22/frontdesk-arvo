import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frontdesk – Arvo Support System",
  description:
    "Intelligent SLA & Support Platform for Arvo Systems with business-hours engine, atomic concurrency, and immutable audit logs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-100 text-slate-900 font-sans">
        {children}
      </body>
    </html>
  );
}
