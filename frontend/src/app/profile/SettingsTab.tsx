"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { getSettings, isApiRequestError, updateSettings } from "@/lib/api";

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

function parsePreferences(input: string): Record<string, unknown> {
  const parsed = JSON.parse(input) as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Preferences must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export function SettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferencesText, setPreferencesText] = useState("{}");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getSettings();
        setPreferencesText(JSON.stringify(data.preferences ?? {}, null, 2));
      } catch (loadError) {
        setError(formatApiError(loadError, "Failed to load settings"));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const handleSave = async () => {
    setSuccess("");
    setError("");

    let parsedPreferences: Record<string, unknown>;
    try {
      parsedPreferences = parsePreferences(preferencesText);
    } catch (parseError) {
      const message =
        parseError instanceof Error
          ? parseError.message
          : "Preferences JSON is invalid";
      setError(message);
      return;
    }

    setSaving(true);
    try {
      const updated = await updateSettings(parsedPreferences);
      setPreferencesText(JSON.stringify(updated.preferences ?? {}, null, 2));
      setSuccess("Settings saved");
    } catch (saveError) {
      setError(formatApiError(saveError, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </p>
      )}

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Toggle your interface theme.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-md border bg-background p-1">
          <ThemeToggle />
          <span className="pr-2 text-xs text-muted-foreground">Theme toggle</span>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Preferences</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit stored preferences as JSON for future profile settings.
        </p>

        <textarea
          className="mt-4 min-h-56 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          value={preferencesText}
          onChange={(event) => setPreferencesText(event.target.value)}
          spellCheck={false}
          disabled={loading || saving}
        />

        <div className="mt-4 flex justify-end">
          <Button onClick={() => void handleSave()} disabled={loading || saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </section>
    </div>
  );
}
