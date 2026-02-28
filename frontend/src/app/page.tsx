"use client";

import { useMemo, useState } from "react";
import { Plus, VideoOff, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toolbar } from "@/components/Toolbar";
import { VideoInput } from "@/components/VideoInput";
import { VideoCard } from "@/components/VideoCard";
import { VideoListItem } from "@/components/VideoListItem";
import { ExtractionProgress } from "@/components/LoadingState";
import { useExtraction } from "@/context/extraction";

export default function HomePage() {
  const {
    extraction,
    extract,
    videos,
    loadingVideos: loading,
    extractError: error,
    extractInfo: info,
  } = useExtraction();

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [showInput, setShowInput] = useState(false);

  const isExtracting = extraction !== null;

  const allKeywords = useMemo(() => {
    const counts = new Map<string, number>();
    videos.forEach((v) =>
      v.keywords?.forEach((kw) => counts.set(kw, (counts.get(kw) || 0) + 1)),
    );
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([kw]) => kw);
  }, [videos]);

  const filtered = useMemo(() => {
    let result = videos;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.title?.toLowerCase().includes(q) ||
          v.channel_name?.toLowerCase().includes(q) ||
          v.keywords?.some((kw) => kw.toLowerCase().includes(q)),
      );
    }
    if (selectedKeywords.length > 0) {
      result = result.filter((v) =>
        selectedKeywords.every((kw) => v.keywords?.includes(kw)),
      );
    }
    return result;
  }, [videos, search, selectedKeywords]);

  const handleExtract = async (url: string) => {
    await extract(url);
    setShowInput(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Toolbar
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
        availableKeywords={allKeywords}
        selectedKeywords={selectedKeywords}
        onKeywordsChange={setSelectedKeywords}
      />

      <main className="px-6 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">
              {filtered.length} video{filtered.length !== 1 ? "s" : ""}
            </h1>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {info && <p className="text-sm text-muted-foreground">{info}</p>}
          </div>
          {!showInput && (
            <Button onClick={() => setShowInput(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Video
            </Button>
          )}
        </div>

        {showInput && (
          <div className="mb-4 max-w-xl">
            <VideoInput onSubmit={handleExtract} isLoading={isExtracting} />
          </div>
        )}

        {isExtracting && (
          <div className="mb-8 max-w-xl">
            <ExtractionProgress />
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {!loading && videos.length === 0 && !isExtracting && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <VideoOff className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium">No videos yet</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Add your first YouTube video to start building your knowledge base.
            </p>
            {!showInput && (
              <Button onClick={() => setShowInput(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Video
              </Button>
            )}
          </div>
        )}

        {!loading && videos.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium">No matches</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Try a different search term or clear your filters.
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && view === "grid" && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] items-stretch gap-4">
            {filtered.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}

        {!loading && filtered.length > 0 && view === "list" && (
          <div className="space-y-1">
            {filtered.map((video) => (
              <VideoListItem key={video.id} video={video} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
