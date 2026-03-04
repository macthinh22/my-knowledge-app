"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Plus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import {
  createCategory,
  deleteCategory,
  isApiRequestError,
  listCategories,
  listVideos,
  updateCategory,
  type Category,
} from "@/lib/api";
import {
  PRESET_COLORS,
  getCategoryBadgeClass,
  isDefaultCategory,
} from "@/lib/categories";
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
import { Badge } from "@/components/ui/badge";
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

const COLOR_DOT_CLASS: Record<string, string> = {
  slate: "bg-slate-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => {
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order;
    }
    return a.created_at.localeCompare(b.created_at);
  });
}

function ColorPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (next: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_COLORS.map((color) => {
        const active = selected === color;
        return (
          <button
            key={color}
            type="button"
            className={`h-7 w-7 rounded-full border ${COLOR_DOT_CLASS[color] ?? COLOR_DOT_CLASS.slate} ${active ? "ring-2 ring-primary ring-offset-2" : "opacity-80 hover:opacity-100"}`}
            onClick={() => onSelect(color)}
            aria-label={`Select ${color} color`}
            title={color}
          />
        );
      })}
    </div>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [videoCounts, setVideoCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("slate");
  const [addOpen, setAddOpen] = useState(false);

  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState("slate");

  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);

  const orderedCategories = useMemo(() => sortCategories(categories), [categories]);
  const generatedSlug = useMemo(() => slugify(newName), [newName]);

  const loadVideoCounts = useCallback(async () => {
    const counts: Record<string, number> = {};
    const limit = 100;
    let offset = 0;
    let total = 0;

    do {
      const page = await listVideos({ limit, offset });
      total = page.total;
      page.items.forEach((video) => {
        if (!video.category) {
          return;
        }
        counts[video.category] = (counts[video.category] ?? 0) + 1;
      });
      offset += page.items.length;
      if (page.items.length === 0) {
        break;
      }
    } while (offset < total);

    return counts;
  }, []);

  const refreshData = useCallback(
    async (showLoading = false) => {
      if (showLoading) {
        setLoading(true);
      }
      setError("");
      try {
        const [nextCategories, nextVideoCounts] = await Promise.all([
          listCategories(),
          loadVideoCounts(),
        ]);
        setCategories(sortCategories(nextCategories));
        setVideoCounts(nextVideoCounts);
      } catch (loadError) {
        setError(formatApiError(loadError, "Failed to load categories"));
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [loadVideoCounts],
  );

  useEffect(() => {
    void refreshData(true);
  }, [refreshData]);

  const startEdit = (category: Category) => {
    setEditingSlug(category.slug);
    setEditingName(category.name);
    setEditingColor(category.color ?? "slate");
    setError("");
  };

  const cancelEdit = () => {
    setEditingSlug(null);
    setEditingName("");
    setEditingColor("slate");
  };

  const handleCreate = async () => {
    const trimmedName = newName.trim();
    const slug = slugify(trimmedName);

    if (!trimmedName) {
      setError("Name is required");
      return;
    }
    if (!slug) {
      setError("Could not generate a valid slug from this name");
      return;
    }
    if (orderedCategories.some((category) => category.slug === slug)) {
      setError("A category with this name already exists");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await createCategory(slug, trimmedName, newColor);
      setNewName("");
      setNewColor("slate");
      setAddOpen(false);
      await refreshData();
    } catch (createError) {
      setError(formatApiError(createError, "Failed to create category"));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingSlug) {
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
      await updateCategory(editingSlug, {
        name: trimmedName,
        color: editingColor,
      });
      cancelEdit();
      await refreshData();
    } catch (updateError) {
      setError(formatApiError(updateError, "Failed to update category"));
    } finally {
      setBusy(false);
    }
  };

  const moveCategory = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= orderedCategories.length) {
      return;
    }

    const current = orderedCategories[index];
    const target = orderedCategories[nextIndex];
    if (!current || !target) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      await Promise.all([
        updateCategory(current.slug, { display_order: target.display_order }),
        updateCategory(target.slug, { display_order: current.display_order }),
      ]);
      await refreshData();
    } catch (reorderError) {
      setError(formatApiError(reorderError, "Failed to reorder categories"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteSlug) {
      return;
    }

    const slugToDelete = deleteSlug;

    setBusy(true);
    setError("");
    try {
      try {
        await deleteCategory(slugToDelete);
      } catch (deleteError) {
        if (!(isApiRequestError(deleteError) && deleteError.status === 404)) {
          throw deleteError;
        }
      }

      setDeleteSlug(null);
      if (editingSlug === slugToDelete) {
        cancelEdit();
      }

      setCategories((current) =>
        current.filter((category) => category.slug !== slugToDelete)
      );
      setVideoCounts((current) => {
        if (!(slugToDelete in current)) {
          return current;
        }
        const next = { ...current };
        delete next[slugToDelete];
        return next;
      });

      await refreshData();
    } catch (deleteError) {
      setError(formatApiError(deleteError, "Failed to delete category"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Category Management</h1>
              <p className="text-sm text-muted-foreground">
                Manage category names, colors, ordering, and deletion.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <section className="flex justify-end">
          <Dialog
            open={addOpen}
            onOpenChange={(open) => {
              if (busy) {
                return;
              }
              setAddOpen(open);
              setError("");
              if (!open) {
                setNewName("");
                setNewColor("slate");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Category</DialogTitle>
                <DialogDescription>
                  Create a new category with a name and color.
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
                    placeholder="e.g. Product Design"
                    disabled={busy}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Slug preview: {generatedSlug || "-"}
                </p>
                <div>
                  <label className="mb-2 block text-xs font-medium text-muted-foreground">
                    Color
                  </label>
                  <ColorPicker selected={newColor} onSelect={setNewColor} />
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
                  Add
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>

        <section className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-center">Color</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Slug</th>
                <th className="px-4 py-3 text-center">Videos</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                    Loading categories...
                  </td>
                </tr>
              ) : orderedCategories.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                    No categories found.
                  </td>
                </tr>
              ) : (
                orderedCategories.map((category, index) => {
                  const inEditMode = editingSlug === category.slug;
                  const colorKey = category.color ?? "slate";
                  return (
                    <tr key={category.id} className="border-t align-top">
                      <td className="px-4 py-3 align-middle">
                        <div className="flex justify-center">
                          <div
                            className={`h-4 w-4 rounded-full ${COLOR_DOT_CLASS[colorKey] ?? COLOR_DOT_CLASS.slate}`}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {inEditMode ? (
                          <div className="space-y-3">
                            <Input
                              value={editingName}
                              onChange={(event) => setEditingName(event.target.value)}
                              disabled={busy}
                            />
                            <ColorPicker
                              selected={editingColor}
                              onSelect={setEditingColor}
                            />
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="font-medium">{category.name}</p>
                            <Badge
                              variant="outline"
                              className={getCategoryBadgeClass(category.color)}
                            >
                              {category.color ?? "slate"}
                            </Badge>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{category.slug}</td>
                      <td className="px-4 py-3 text-center align-middle">
                        {videoCounts[category.slug] ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          {inEditMode ? (
                            <>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => void handleSaveEdit()}
                                disabled={busy}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={cancelEdit}
                                disabled={busy}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => startEdit(category)}
                              disabled={busy}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}

                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => void moveCategory(index, -1)}
                            disabled={busy || index === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => void moveCategory(index, 1)}
                            disabled={busy || index === orderedCategories.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>

                          {!isDefaultCategory(category.slug) && (
                            <Button
                              size="icon"
                              variant="destructive"
                              onClick={() => setDeleteSlug(category.slug)}
                              disabled={busy}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>

      </main>

      <AlertDialog
        open={deleteSlug !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setDeleteSlug(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this category?</AlertDialogTitle>
            <AlertDialogDescription>
              Videos currently assigned to this category will be uncategorized.
              This action cannot be undone.
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
              disabled={busy || !deleteSlug}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
