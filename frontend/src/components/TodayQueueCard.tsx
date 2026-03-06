import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

import type { VideoListItem } from "@/lib/api";

type TodayQueueCardProps = {
  title: string;
  count: number;
  emptyMessage: string;
  href: string;
  items: VideoListItem[];
};

export function TodayQueueCard({
  title,
  count,
  emptyMessage,
  href,
  items,
}: TodayQueueCardProps) {
  const previewItems = items.slice(0, 3);

  return (
    <section className="flex flex-col rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {count}
        </span>
      </div>

      <div className="flex-1">
        {previewItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="space-y-2">
            {previewItems.map((item) => (
              <li key={item.id} className="rounded-lg border bg-background px-3 py-2">
                <Link href={`/video/${item.id}`} className="block min-w-0">
                  <p className="truncate text-sm font-medium">{item.title ?? "Untitled"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(item.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Open queue
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
