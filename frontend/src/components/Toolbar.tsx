"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, X, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "./ThemeToggle";
import { ViewToggle } from "./ViewToggle";

interface ToolbarProps {
  onSearchChange: (query: string) => void;
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
  availableKeywords?: string[];
  selectedKeywords?: string[];
  onKeywordsChange?: (keywords: string[]) => void;
}

export function Toolbar({
  onSearchChange,
  view,
  onViewChange,
  availableKeywords = [],
  selectedKeywords = [],
  onKeywordsChange,
}: ToolbarProps) {
  const [query, setQuery] = useState("");
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
          <ViewToggle view={view} onViewChange={onViewChange} />
          <ThemeToggle />
        </div>
      </div>

      {availableKeywords.length > 0 && (
        <div className="flex items-center gap-2 px-6 pb-3 overflow-x-auto">
          {availableKeywords.slice(0, 15).map((kw) => (
            <Badge
              key={kw}
              variant={selectedKeywords.includes(kw) ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap"
              onClick={() => toggleKeyword(kw)}
            >
              {kw}
            </Badge>
          ))}
        </div>
      )}
    </header>
  );
}
