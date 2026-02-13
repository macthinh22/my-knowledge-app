interface KeywordBadgeProps {
  keyword: string;
}

export default function KeywordBadge({ keyword }: KeywordBadgeProps) {
  return (
    <span
      className="inline-block px-3 py-1 text-xs font-medium leading-snug
                 text-[var(--accent)] bg-[var(--accent-subtle)]
                 border border-[var(--accent-light)] rounded-full
                 whitespace-nowrap transition-all duration-150
                 hover:bg-[var(--accent-light)]"
    >
      {keyword}
    </span>
  );
}
