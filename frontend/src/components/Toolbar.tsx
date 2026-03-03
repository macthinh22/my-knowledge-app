"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, X, BookOpen, SlidersHorizontal, Check, ArrowUpDown, BarChart3, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Category, TagSummary } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export type SortOption = `${"created_at" | "title" | "duration" | "channel_name"}_${"asc" | "desc"}`;

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "created_at_desc", label: "Newest first" },
  { value: "created_at_asc", label: "Oldest first" },
  { value: "title_asc", label: "Title A-Z" },
  { value: "title_desc", label: "Title Z-A" },
  { value: "duration_desc", label: "Duration: longest" },
  { value: "duration_asc", label: "Duration: shortest" },
  { value: "channel_name_asc", label: "Channel A-Z" },
];

interface ToolbarProps {
  onSearchChange: (query: string) => void;
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
  sortOption?: SortOption;
  onSortChange?: (option: SortOption) => void;
  availableTags?: TagSummary[];
  availableCategories?: Category[];
  categoryVideoCounts?: Record<string, number>;
  selectedKeywords?: string[];
  selectedCategory?: string | null;
  onKeywordsChange?: (keywords: string[]) => void;
  onCategoryChange?: (category: string | null) => void;
  keywordFilterMode?: "all" | "any";
  onKeywordFilterModeChange?: (mode: "all" | "any") => void;
  reviewStatus?: string | null;
  onReviewStatusChange?: (status: string | null) => void;
  onTagDataChanged?: () => Promise<void> | void;
  onCategoryDataChanged?: (deletedSlug?: string) => Promise<void> | void;
}

export function Toolbar({
  onSearchChange,
  view,
  onViewChange,
  sortOption = "created_at_desc",
  onSortChange,
  availableTags = [],
  availableCategories = [],
  categoryVideoCounts = {},
  selectedKeywords = [],
  selectedCategory = null,
  onKeywordsChange,
  onCategoryChange,
  keywordFilterMode = "all",
  onKeywordFilterModeChange,
  reviewStatus = null,
  onReviewStatusChange,
  onTagDataChanged,
  onCategoryDataChanged,
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {SORT_OPTIONS.find((o) => o.value === sortOption)?.label ?? "Sort"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  className={cn(
                    sortOption === opt.value && "bg-primary/10 font-medium"
                  )}
                  onClick={() => onSortChange?.(opt.value)}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <BarChart3 className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/categories">
              <SlidersHorizontal className="h-4 w-4" />
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-t px-6 py-2">
        <Button
          size="sm"
          variant={selectedCategory === null ? "default" : "outline"}
          onClick={() => onCategoryChange?.(null)}
        >
          All
        </Button>
        {availableCategories.map((category) => (
          <Button
            key={category.id}
            size="sm"
            variant={selectedCategory === category.slug ? "default" : "outline"}
            onClick={() => onCategoryChange?.(category.slug)}
          >
            {category.name} ({categoryVideoCounts[category.slug] ?? 0})
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 border-l pl-3">
          {[
            { value: null, label: "All" },
            { value: "never_viewed", label: "Never viewed" },
            { value: "stale", label: "Needs review" },
            { value: "recent", label: "Recently viewed" },
          ].map((opt) => (
            <Button
              key={opt.value ?? "all"}
              size="sm"
              variant={reviewStatus === opt.value ? "secondary" : "ghost"}
              className="h-7 text-xs"
              onClick={() => onReviewStatusChange?.(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>
    </header>
  );
}
