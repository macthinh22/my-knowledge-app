"use client";

import { useState } from "react";
import { Loader2, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Category, CollectionItem } from "@/lib/api";

type VideoActionDropdownProps = {
  categories: Category[];
  currentCategory: string | null;
  collections: CollectionItem[];
  selectedCollectionIds: Set<string>;
  onCategoryChange: (category: string | null) => Promise<void>;
  onCollectionToggle: (collectionId: string, checked: boolean) => Promise<void>;
  onDelete: () => void;
  disabled?: boolean;
};

const NO_CATEGORY_VALUE = "__none__";

export function VideoActionDropdown({
  categories,
  currentCategory,
  collections,
  selectedCollectionIds,
  onCategoryChange,
  onCollectionToggle,
  onDelete,
  disabled = false,
}: VideoActionDropdownProps) {
  const [pendingCategory, setPendingCategory] = useState(false);
  const [pendingCollectionId, setPendingCollectionId] = useState<string | null>(
    null,
  );

  const handleCategoryChange = async (nextCategory: string | null) => {
    setPendingCategory(true);
    try {
      await onCategoryChange(nextCategory);
    } finally {
      setPendingCategory(false);
    }
  };

  const handleCollectionToggle = async (collectionId: string, checked: boolean) => {
    setPendingCollectionId(collectionId);
    try {
      await onCollectionToggle(collectionId, checked);
    } finally {
      setPendingCollectionId(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          aria-label="Open resource actions"
          className="rounded-full bg-black/40 text-white ring-2 ring-white/30 backdrop-blur-sm hover:bg-black/60 hover:text-white"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-52"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            onClick={(event) => event.stopPropagation()}
            onSelect={(event) => event.stopPropagation()}
          >
            Category
            {pendingCategory && <Loader2 className="ml-2 h-3 w-3 animate-spin" />}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <DropdownMenuRadioGroup
              value={currentCategory ?? NO_CATEGORY_VALUE}
              onValueChange={(value) => {
                const nextCategory =
                  value === NO_CATEGORY_VALUE ? null : value;
                void handleCategoryChange(nextCategory);
              }}
            >
              <DropdownMenuRadioItem
                value={NO_CATEGORY_VALUE}
                onSelect={(event) => event.stopPropagation()}
              >
                No category
              </DropdownMenuRadioItem>
              {categories.map((category) => (
                <DropdownMenuRadioItem
                  key={category.id}
                  value={category.slug}
                  onSelect={(event) => event.stopPropagation()}
                >
                  {category.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            onClick={(event) => event.stopPropagation()}
            onSelect={(event) => event.stopPropagation()}
          >
            Collections
            {pendingCollectionId && (
              <Loader2 className="ml-2 h-3 w-3 animate-spin" />
            )}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {collections.length === 0 && (
              <DropdownMenuItem disabled>No collections</DropdownMenuItem>
            )}
            {collections.map((collection) => (
              <DropdownMenuCheckboxItem
                key={collection.id}
                checked={selectedCollectionIds.has(collection.id)}
                disabled={pendingCollectionId === collection.id}
                onSelect={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onCheckedChange={(checked) => {
                  void handleCollectionToggle(collection.id, Boolean(checked));
                }}
              >
                {collection.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onSelect={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-4 w-4" />
          Delete resource
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            onClick={(event) => event.stopPropagation()}
            onSelect={(event) => event.stopPropagation()}
          >
            More
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <DropdownMenuItem disabled>Coming soon</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type { VideoActionDropdownProps };
