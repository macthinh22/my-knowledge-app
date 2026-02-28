"use client";

import { useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface VideoInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

const YOUTUBE_REGEX =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)/;

export function VideoInput({ onSubmit, isLoading }: VideoInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!YOUTUBE_REGEX.test(trimmed)) {
      setError("Please enter a valid YouTube URL");
      return;
    }
    setError("");
    onSubmit(trimmed);
    setUrl("");
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="relative flex gap-2">
      <div className="relative flex-1">
        <Link2 className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Paste a YouTube URL..."
          className="pl-9"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError("");
          }}
          disabled={isLoading}
        />
      </div>
      <Button type="submit" disabled={isLoading || !url.trim()}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Extracting...
          </>
        ) : (
          "Extract"
        )}
      </Button>
      {error && (
        <p className="absolute -bottom-6 left-0 text-xs text-destructive">{error}</p>
      )}
    </form>
  );
}
