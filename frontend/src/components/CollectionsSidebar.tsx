"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Plus, Trash2, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  listCollections,
  createCollection,
  deleteCollection,
  type CollectionItem,
} from "@/lib/api";

interface CollectionsSidebarProps {
  selectedCollection: string | null;
  onCollectionChange: (id: string | null) => void;
  onCollectionsChanged?: () => void;
}

export function CollectionsSidebar({
  selectedCollection,
  onCollectionChange,
  onCollectionsChanged,
}: CollectionsSidebarProps) {
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(() => {
    listCollections().then(setCollections).catch(() => setCollections([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createCollection(newName.trim());
      setNewName("");
      setShowCreate(false);
      refresh();
      onCollectionsChanged?.();
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCollection(id);
      if (selectedCollection === id) onCollectionChange(null);
      refresh();
      onCollectionsChanged?.();
    } catch {
      // ignore
    }
  };

  return (
    <aside className="w-56 shrink-0 border-r bg-muted/30">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-sm font-medium">Collections</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {showCreate && (
        <div className="px-3 py-2 border-b space-y-2">
          <Input
            placeholder="Collection name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              className="flex-1"
              disabled={!newName.trim() || creating}
              onClick={handleCreate}
            >
              Create
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowCreate(false);
                setNewName("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <nav className="py-1">
        <button
          type="button"
          onClick={() => onCollectionChange(null)}
          className={cn(
            "flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors",
            selectedCollection === null
              ? "bg-accent font-medium"
              : "hover:bg-accent/50",
          )}
        >
          <Library className="h-4 w-4" />
          All Videos
        </button>

        {collections.map((col) => (
          <div
            key={col.id}
            className={cn(
              "group flex items-center gap-2 px-4 py-2 text-sm transition-colors",
              selectedCollection === col.id
                ? "bg-accent font-medium"
                : "hover:bg-accent/50",
            )}
          >
            <button
              type="button"
              className="flex flex-1 items-center gap-2 min-w-0"
              onClick={() => onCollectionChange(col.id)}
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span className="truncate">{col.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {col.video_count}
              </span>
            </button>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleDelete(col.id)}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}
