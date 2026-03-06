"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  FolderOpen,
  LogOut,
  Search,
  Settings,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth";
import { ThemeToggle } from "./ThemeToggle";

export function DashboardToolbar() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { username, logout } = useAuth();

  const handleSearch = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const query = search.trim();
      if (query) {
        router.push(`/browse?q=${encodeURIComponent(query)}`);
      }
    },
    [router, search],
  );

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-5 w-5" />
          <span className="hidden sm:inline">Knowledge Base</span>
        </Link>

        <form
          onSubmit={handleSearch}
          className="relative ml-auto flex w-full max-w-sm items-center"
        >
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search resources..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard" aria-label="Open analytics dashboard">
              <BarChart3 className="h-4 w-4" />
            </Link>
          </Button>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8 rounded-full"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {username ? username[0].toUpperCase() : "?"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                {username ? `@${username}` : "Signed in"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile?tab=categories">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Categories
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile?tab=collections">
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Collections
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile?tab=settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void logout()}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
