import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-8">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--fg-muted)]">
        <circle cx="12" cy="12" r="10" />
        <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
      <h1 className="font-[var(--font-heading)] text-4xl font-bold text-[var(--fg-primary)]">
        404
      </h1>
      <p className="text-lg text-[var(--fg-secondary)] max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-2 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
      >
        &larr; Back to library
      </Link>
    </div>
  );
}
