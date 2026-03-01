import { cn } from "@/lib/utils";

interface KeywordChipsProps {
  keywords: string[] | null | undefined;
  maxVisible?: number;
  className?: string;
}

export function KeywordChips({ keywords, maxVisible = 3, className }: KeywordChipsProps) {
  const uniqueKeywords = Array.from(
    new Set((keywords ?? []).map((kw) => kw.trim()).filter(Boolean)),
  );

  if (uniqueKeywords.length === 0) {
    return null;
  }

  const visible = uniqueKeywords.slice(0, maxVisible);
  const remaining = uniqueKeywords.length - visible.length;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {visible.map((keyword) => (
        <span
          key={keyword}
          className="inline-flex max-w-full items-center rounded-md border border-border/70 bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground/80"
          title={keyword}
        >
          <span className="truncate">{keyword}</span>
        </span>
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center rounded-md border border-dashed border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          +{remaining}
        </span>
      )}
    </div>
  );
}
