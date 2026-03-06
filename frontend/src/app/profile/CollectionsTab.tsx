"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createCollection,
  deleteCollection,
  isApiRequestError,
  listCollections,
  updateCollection as updateCollectionApi,
  type CollectionItem,
} from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

function formatApiError(error: unknown, fallback: string): string {
  if (isApiRequestError(error) && error.detail) {
    const detail = error.detail as unknown;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: unknown } | undefined;
      if (typeof first?.msg === "string") {
        return first.msg;
      }
    }

    if (detail && typeof detail === "object") {
      const message = (detail as { msg?: unknown }).msg;
      if (typeof message === "string") {
        return message;
      }
    }

    return fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function CollectionsTab() {
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refreshCollections = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    setError("");
    try {
      const nextCollections = await listCollections();
      setCollections(nextCollections);
    } catch (loadError) {
      setError(formatApiError(loadError, "Failed to load collections"));
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshCollections(true);
  }, [refreshCollections]);

  const resetCreateForm = () => {
    setNewName("");
    setNewDescription("");
  };

  const startEdit = (collection: CollectionItem) => {
    setEditingId(collection.id);
    setEditingName(collection.name);
    setEditingDescription(collection.description ?? "");
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingDescription("");
  };

  const handleCreate = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await createCollection(trimmedName, newDescription.trim() || undefined);
      setAddOpen(false);
      resetCreateForm();
      await refreshCollections();
    } catch (createError) {
      setError(formatApiError(createError, "Failed to create collection"));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) {
      return;
    }
    const trimmedName = editingName.trim();
    if (!trimmedName) {
      setError("Name cannot be empty");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await updateCollectionApi(editingId, {
        name: trimmedName,
        description: editingDescription.trim(),
      });
      cancelEdit();
      await refreshCollections();
    } catch (updateError) {
      setError(formatApiError(updateError, "Failed to update collection"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) {
      return;
    }

    const targetId = deleteId;
    setBusy(true);
    setError("");
    try {
      try {
        await deleteCollection(targetId);
      } catch (deleteError) {
        if (!(isApiRequestError(deleteError) && deleteError.status === 404)) {
          throw deleteError;
        }
      }

      setDeleteId(null);
      if (editingId === targetId) {
        cancelEdit();
      }

      setCollections((current) =>
        current.filter((collection) => collection.id !== targetId)
      );
      await refreshCollections();
    } catch (deleteError) {
      setError(formatApiError(deleteError, "Failed to delete collection"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="mb-4 flex justify-end">
        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            if (busy) {
              return;
            }
            setAddOpen(open);
            setError("");
            if (!open) {
              resetCreateForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Collection
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Collection</DialogTitle>
              <DialogDescription>
                Group videos into a reusable collection.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Name
                </label>
                <Input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="e.g. Product Strategy"
                  disabled={busy}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Description (optional)
                </label>
                <Input
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  placeholder="e.g. Talks to revisit before Q2 planning"
                  disabled={busy}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAddOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleCreate()}
                disabled={busy || !newName.trim()}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      <section className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-center">Videos</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={4}>
                  Loading collections...
                </td>
              </tr>
            ) : collections.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={4}>
                  No collections found.
                </td>
              </tr>
            ) : (
              collections.map((collection) => (
                <tr key={collection.id} className="border-t">
                  <td className="px-4 py-3 align-middle text-left">
                    <p className="font-medium">{collection.name}</p>
                  </td>
                  <td className="px-4 py-3 align-middle text-left text-muted-foreground">
                    {collection.description?.trim() || "-"}
                  </td>
                  <td className="px-4 py-3 text-center align-middle">
                    {collection.video_count}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => startEdit(collection)}
                        disabled={busy}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => setDeleteId(collection.id)}
                        disabled={busy}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <Dialog
        open={editingId !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            cancelEdit();
            setError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Collection</DialogTitle>
            <DialogDescription>
              Update collection name and description.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Name
              </label>
              <Input
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                placeholder="e.g. Product Strategy"
                disabled={busy}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Description (optional)
              </label>
              <Input
                value={editingDescription}
                onChange={(event) => setEditingDescription(event.target.value)}
                placeholder="e.g. Talks to revisit before Q2 planning"
                disabled={busy}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cancelEdit} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleSaveEdit()}
              disabled={busy || !editingName.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setDeleteId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this collection?</AlertDialogTitle>
            <AlertDialogDescription>
              Videos will remain in your library, but this collection will be
              removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={busy || !deleteId}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
