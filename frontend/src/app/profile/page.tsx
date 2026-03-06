"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  FolderOpen,
  Settings,
  SlidersHorizontal,
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AccountTab } from "./AccountTab";
import { CategoriesTab } from "./CategoriesTab";
import { CollectionsTab } from "./CollectionsTab";
import { SettingsTab } from "./SettingsTab";

const TABS = [
  { key: "categories", label: "Categories", icon: SlidersHorizontal },
  { key: "collections", label: "Collections", icon: FolderOpen },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "account", label: "Account", icon: UserCircle },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function resolveActiveTab(value: string | null): TabKey {
  if (!value) {
    return "categories";
  }
  if (TABS.some((tab) => tab.key === value)) {
    return value as TabKey;
  }
  return "categories";
}

export default function ProfilePage() {
  const searchParams = useSearchParams();
  const activeTab = resolveActiveTab(searchParams.get("tab"));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">Profile</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:gap-6">
          <nav className="hidden w-48 shrink-0 space-y-1 md:block">
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                href={`/profile?tab=${tab.key}`}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  activeTab === tab.key
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </Link>
            ))}
          </nav>

          <main className="min-w-0 flex-1">
            <div className="mb-4 flex gap-1 overflow-x-auto md:hidden">
              {TABS.map((tab) => (
                <Link
                  key={tab.key}
                  href={`/profile?tab=${tab.key}`}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    activeTab === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </Link>
              ))}
            </div>

            {activeTab === "categories" && <CategoriesTab />}
            {activeTab === "collections" && <CollectionsTab />}
            {activeTab === "settings" && <SettingsTab />}
            {activeTab === "account" && <AccountTab />}
          </main>
        </div>
      </div>
    </div>
  );
}
