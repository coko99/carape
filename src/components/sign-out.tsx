"use client";

import { authClient } from "@/lib/auth-client";

export function SignOut({ label }: { label: string }) {
  return (
    <button
      className="btn ghost mt-8"
      type="button"
      onClick={async () => {
        await authClient.signOut();
        window.location.href = "/";
      }}
    >
      {label}
    </button>
  );
}
