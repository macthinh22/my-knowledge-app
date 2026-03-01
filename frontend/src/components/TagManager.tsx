"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Tags, Trash2, Combine } from "lucide-react";
import {
  createTagAlias,
  deleteTag,
  deleteTagAlias,
  listTagAliases,
  mergeTags,
  renameTag,
  type TagAlias,
  type TagSummary,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface TagManagerProps {
  tags: TagSummary[];
  onChanged: () => Promise<void> | void;
}

export function TagManager({ tags, onChanged }: TagManagerProps) {
  const [renameFrom, setRenameFrom] = useState("");
  const [renameTo, setRenameTo] = useState("");
  const [mergeSource, setMergeSource] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [deleteValue, setDeleteValue] = useState("");
  const [aliasValue, setAliasValue] = useState("");
  const [canonicalValue, setCanonicalValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [aliases, setAliases] = useState<TagAlias[]>([]);

  const refreshAliases = useCallback(async () => {
    try {
      const items = await listTagAliases();
      setAliases(items);
    } catch {
      setAliases([]);
    }
  }, []);

  useEffect(() => {
    void refreshAliases();
  }, [refreshAliases]);

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await onChanged();
      await refreshAliases();
      setMessage(successMessage);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Tag action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Tags className="mr-2 h-4 w-4" />
          Manage Tags
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tag Management</DialogTitle>
          <DialogDescription>
            Rename, merge, delete tags, and maintain aliases in one place.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-muted-foreground">{message}</p>}

          <section className="rounded-md border p-3">
            <h3 className="mb-2 text-sm font-medium">Current tags</h3>
            <div className="space-y-2">
              {tags.length === 0 && (
                <p className="text-xs text-muted-foreground">No tags yet.</p>
              )}
              {tags.map((item) => (
                <div key={item.tag} className="flex items-center justify-between gap-3 rounded border p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.tag}</p>
                    <p className="text-xs text-muted-foreground">
                      used {item.usage_count} times
                      {item.last_used_at
                        ? ` · last used ${new Date(item.last_used_at).toLocaleDateString()}`
                        : ""}
                    </p>
                    {item.aliases.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        aliases: {item.aliases.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setRenameFrom(item.tag);
                        setRenameTo("");
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => setDeleteValue(item.tag)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Rename tag</h3>
              <Input
                placeholder="From tag"
                value={renameFrom}
                onChange={(e) => setRenameFrom(e.target.value)}
              />
              <Input
                placeholder="To tag"
                value={renameTo}
                onChange={(e) => setRenameTo(e.target.value)}
              />
              <Button
                size="sm"
                disabled={busy || !renameFrom.trim() || !renameTo.trim()}
                onClick={() =>
                  runAction(
                    async () => {
                      await renameTag(renameFrom, renameTo);
                    },
                    "Tag renamed successfully",
                  )
                }
              >
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Rename
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Merge tags</h3>
              <Input
                placeholder="Source tags (comma separated)"
                value={mergeSource}
                onChange={(e) => setMergeSource(e.target.value)}
              />
              <Input
                placeholder="Target tag"
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
              />
              <Button
                size="sm"
                disabled={busy || !mergeSource.trim() || !mergeTarget.trim()}
                onClick={() =>
                  runAction(
                    async () => {
                      await mergeTags(
                        mergeSource
                          .split(",")
                          .map((tag) => tag.trim())
                          .filter(Boolean),
                        mergeTarget,
                      );
                    },
                    "Tags merged successfully",
                  )
                }
              >
                <Combine className="mr-2 h-3.5 w-3.5" />
                Merge
              </Button>
            </div>
          </section>

          <section className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Delete tag</h3>
              <Input
                placeholder="Tag to delete"
                value={deleteValue}
                onChange={(e) => setDeleteValue(e.target.value)}
              />
              <Button
                variant="destructive"
                size="sm"
                disabled={busy || !deleteValue.trim()}
                onClick={() =>
                  runAction(
                    async () => {
                      await deleteTag(deleteValue);
                    },
                    "Tag deleted successfully",
                  )
                }
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Alias mapping</h3>
              <Input
                placeholder="Alias"
                value={aliasValue}
                onChange={(e) => setAliasValue(e.target.value)}
              />
              <Input
                placeholder="Canonical tag"
                value={canonicalValue}
                onChange={(e) => setCanonicalValue(e.target.value)}
              />
              <Button
                size="sm"
                disabled={busy || !aliasValue.trim() || !canonicalValue.trim()}
                onClick={() =>
                  runAction(
                    async () => {
                      await createTagAlias(aliasValue, canonicalValue);
                    },
                    "Alias saved successfully",
                  )
                }
              >
                <Plus className="mr-2 h-3.5 w-3.5" />
                Save alias
              </Button>
            </div>
          </section>

          <section className="rounded-md border p-3">
            <h3 className="mb-2 text-sm font-medium">Alias list</h3>
            <div className="space-y-2">
              {aliases.length === 0 && (
                <p className="text-xs text-muted-foreground">No aliases configured.</p>
              )}
              {aliases.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <span>
                    {item.alias} → {item.canonical}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      runAction(
                        async () => {
                          await deleteTagAlias(item.alias);
                        },
                        "Alias removed",
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
