import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CorpLaw Follow-up | Time Societário",
  description:
    "Gera follow-ups por cliente a partir da transcrição da reunião operacional, cruzando com a carteira do ClickUp.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${montserrat.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white text-navy">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
        <footer className="border-t border-navy/10 py-6 text-center text-xs text-navy/50">
          CorpLaw Advogados — ferramenta interna do Time Societário
        </footer>
      </body>
    </html>
  );
}
