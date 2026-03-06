"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth";
import { authFetch } from "@/lib/auth";
import { changePassword, isApiRequestError } from "@/lib/api";

interface AuthMeResponse {
  username?: string;
  created_at?: string;
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

export function AccountTab() {
  const { username } = useAuth();
  const [accountUsername, setAccountUsername] = useState<string | null>(username);
  const [accountCreatedAt, setAccountCreatedAt] = useState<string | null>(null);
  const [accountInfoError, setAccountInfoError] = useState("");
  const [loadingAccountInfo, setLoadingAccountInfo] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAccountInfo() {
      setLoadingAccountInfo(true);
      setAccountInfoError("");
      try {
        const res = await authFetch("/api/auth/me");
        if (!res.ok) {
          throw new Error("Failed to load account info");
        }

        const data = (await res.json()) as AuthMeResponse;
        if (!cancelled) {
          if (typeof data.username === "string") {
            setAccountUsername(data.username);
          }
          setAccountCreatedAt(
            typeof data.created_at === "string" ? data.created_at : null,
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setAccountInfoError(
            formatApiError(loadError, "Failed to load account details"),
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingAccountInfo(false);
        }
      }
    }

    void loadAccountInfo();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (username) {
      setAccountUsername(username);
    }
  }, [username]);

  const createdAtLabel = useMemo(() => {
    if (!accountCreatedAt) {
      return "Unavailable";
    }

    const parsed = new Date(accountCreatedAt);
    if (Number.isNaN(parsed.getTime())) {
      return "Unavailable";
    }

    return parsed.toLocaleString();
  }, [accountCreatedAt]);

  const handleChangePassword = async () => {
    setError("");
    setSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All password fields are required");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation must match");
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password updated successfully");
    } catch (changeError) {
      setError(formatApiError(changeError, "Failed to update password"));
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
        <h2 className="text-base font-semibold">Account Info</h2>
        {accountInfoError && (
          <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {accountInfoError}
          </p>
        )}
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Username
            </dt>
            <dd className="mt-1 font-medium">
              {accountUsername ? `@${accountUsername}` : "Unknown user"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Created
            </dt>
            <dd className="mt-1 font-medium">
              {loadingAccountInfo ? "Loading..." : createdAtLabel}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Change Password</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use your current password to set a new one.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Current password
            </label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={saving}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              New password
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={saving}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Confirm new password
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => void handleChangePassword()}
            disabled={saving}
          >
            {saving ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </section>
    </div>
  );
}
