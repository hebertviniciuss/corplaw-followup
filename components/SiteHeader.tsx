import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="border-b border-navy/10 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M10.2 4h3.6l6.6 15.4h-3.9l-1.4-3.4h-3l1.1-2.7h.8L11.8 8l-4.6 11.4H3.3z"
              fill="#14a38c"
            />
          </svg>
          <span className="text-lg font-semibold tracking-tight text-navy">
            CorpLaw <span className="font-normal text-teal-dark">Follow-up</span>
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-navy/70">
          <Link href="/" className="transition-colors hover:text-teal-dark">
            Carteira
          </Link>
          <Link href="/reuniao" className="transition-colors hover:text-teal-dark">
            Reunião Operacional
          </Link>
          <Link href="/historico" className="transition-colors hover:text-teal-dark">
            Histórico
          </Link>
          <Link href="/whatsapp" className="transition-colors hover:text-teal-dark">
            Grupos WhatsApp
          </Link>
        </nav>
      </div>
    </header>
  );
}
