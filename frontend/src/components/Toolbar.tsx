"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, X, BookOpen, SlidersHorizontal, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TagSummary } from "@/lib/api";
import { TagManager } from "./TagManager";
import { ThemeToggle } from "./ThemeToggle";
import { ViewToggle } from "./ViewToggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ToolbarProps {
  onSearchChange: (query: string) => void;
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
  availableTags?: TagSummary[];
  selectedKeywords?: string[];
  onKeywordsChange?: (keywords: string[]) => void;
  keywordFilterMode?: "all" | "any";
  onKeywordFilterModeChange?: (mode: "all" | "any") => void;
  onTagDataChanged?: () => Promise<void> | void;
}

export function Toolbar({
  onSearchChange,
  view,
  onViewChange,
  availableTags = [],
  selectedKeywords = [],
  onKeywordsChange,
  keywordFilterMode = "all",
  onKeywordFilterModeChange,
  onTagDataChanged,
}: ToolbarProps) {
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onSearchChange(value), 250);
    },
    [onSearchChange],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function toggleKeyword(kw: string) {
    if (!onKeywordsChange) return;
    if (selectedKeywords.includes(kw)) {
      onKeywordsChange(selectedKeywords.filter((k) => k !== kw));
    } else {
      onKeywordsChange([...selectedKeywords, kw]);
    }
  }

  const selectedCount = selectedKeywords.length;
  const visibleTags = availableTags.filter((item) =>
    item.tag.toLowerCase().includes(tagSearch.toLowerCase().trim()),
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-6">
        <div className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-5 w-5" />
          <span className="hidden sm:inline">Knowledge Base</span>
        </div>

        <div className="relative flex-1 max-w-md mx-auto">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search videos..."
            className="pl-9 pr-9"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => handleChange("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters{selectedCount > 0 ? ` (${selectedCount})` : ""}
              </Button>
            </DialogTrigger>
            <DialogContent className="right-0 left-auto top-0 h-screen w-full max-w-md translate-x-0 translate-y-0 rounded-none border-l p-0 sm:max-w-md">
              <DialogHeader className="border-b px-5 py-4">
                <DialogTitle>Filters</DialogTitle>
                <DialogDescription>
                  Refine your library with tag filters and matching mode.
                </DialogDescription>
              </DialogHeader>

              <div className="flex h-[calc(100vh-84px)] flex-col">
                <div className="space-y-4 border-b px-5 py-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Matching mode
                    </p>
                    <div className="inline-flex rounded-lg border bg-muted/30 p-1">
                      <Button
                        size="sm"
                        variant={keywordFilterMode === "all" ? "default" : "ghost"}
                        className="h-8"
                        onClick={() => onKeywordFilterModeChange?.("all")}
                      >
                        All
                      </Button>
                      <Button
                        size="sm"
                        variant={keywordFilterMode === "any" ? "default" : "ghost"}
                        className="h-8"
                        onClick={() => onKeywordFilterModeChange?.("any")}
                      >
                        Any
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Selected tags
                      </p>
                      {selectedCount > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => onKeywordsChange?.([])}
                        >
                          Clear all
                        </Button>
                      )}
                    </div>
                    {selectedCount === 0 ? (
                      <p className="text-sm text-muted-foreground">No tags selected yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedKeywords.map((keyword) => (
                          <Badge key={keyword} variant="secondary" className="gap-1">
                            {keyword}
                            <button
                              type="button"
                              className="rounded-sm p-0.5 hover:bg-black/10"
                              onClick={() => toggleKeyword(keyword)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Find tags
                    </p>
                    <Input
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      placeholder="Search tags..."
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <div className="space-y-2">
                    {visibleTags.length === 0 && (
                      <p className="text-sm text-muted-foreground">No tags found.</p>
                    )}
                    {visibleTags.map((item) => {
                      const selected = selectedKeywords.includes(item.tag);
                      return (
                        <button
                          key={item.tag}
                          type="button"
                          onClick={() => toggleKeyword(item.tag)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors",
                            selected
                              ? "border-primary/60 bg-primary/10"
                              : "hover:bg-accent",
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.tag}</p>
                            <p className="text-xs text-muted-foreground">
                              used {item.usage_count} times
                            </p>
                          </div>
                          {selected && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t px-5 py-4">
                  <TagManager tags={availableTags} onChanged={() => onTagDataChanged?.()} />
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <ViewToggle view={view} onViewChange={onViewChange} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
