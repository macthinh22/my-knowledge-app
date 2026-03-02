"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createCategory, deleteCategory, type Category } from "@/lib/api";
import { isDefaultCategory } from "@/lib/categories";
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

interface CategoryManagerProps {
  categories: Category[];
  onChanged: (deletedSlug?: string) => Promise<void> | void;
}

export function CategoryManager({ categories, onChanged }: CategoryManagerProps) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDeleteSlug, setPendingDeleteSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingDeleteSlug) {
      return;
    }
    const stillExists = categories.some((category) => category.slug === pendingDeleteSlug);
    if (!stillExists) {
      setPendingDeleteSlug(null);
    }
  }, [categories, pendingDeleteSlug]);

  const runAction = async (
    action: () => Promise<void>,
    successMessage: string,
    deletedSlug?: string,
  ) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await onChanged(deletedSlug);
      setMessage(successMessage);
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Category action failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Manage Categories</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Category Management</DialogTitle>
          <DialogDescription>
            Add or remove categories used by analysis and filters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-muted-foreground">{message}</p>}

          <section className="rounded-md border p-3">
            <h3 className="mb-2 text-sm font-medium">Current categories</h3>
            <div className="space-y-2">
              {categories.length === 0 && (
                <p className="text-xs text-muted-foreground">No categories yet.</p>
              )}
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-xs text-muted-foreground">{category.slug}</p>
                  </div>
                  {isDefaultCategory(category.slug) ? (
                    <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
                      Default
                    </span>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => setPendingDeleteSlug(category.slug)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
            <Input
              placeholder="slug (e.g. product-management)"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <Input
              placeholder="name (e.g. Product Management)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="md:col-span-2">
              <Button
                size="sm"
                disabled={busy || !slug.trim() || !name.trim()}
                onClick={() =>
                  void runAction(
                    async () => {
                      await createCategory(slug, name);
                      setSlug("");
                      setName("");
                    },
                    "Category added",
                  )
                }
              >
                <Plus className="mr-2 h-3.5 w-3.5" />
                Add category
              </Button>
            </div>
          </section>
        </div>

        {pendingDeleteSlug && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg border bg-background p-4 shadow-xl">
              <h3 className="text-base font-semibold">Delete category?</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Videos using this category will lose category assignment.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Slug: {pendingDeleteSlug}
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setPendingDeleteSlug(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    const slugToDelete = pendingDeleteSlug;
                    if (isDefaultCategory(slugToDelete)) {
                      setError("Default categories cannot be deleted");
                      setPendingDeleteSlug(null);
                      return;
                    }
                    const deleted = await runAction(
                      async () => {
                        await deleteCategory(slugToDelete);
                      },
                      "Category deleted",
                      slugToDelete,
                    );
                    if (deleted) {
                      setPendingDeleteSlug(null);
                    }
                  }}
                >
                  Delete category
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
