"use server";

import { assistantReply } from "@/server/features";

export async function askAssistantAction(input: { token: string; question: string; email?: string; orderNumber?: string }) {
  if (!input.question.trim() || input.question.length > 500) return { ok: false as const, error: "invalid" };
  return assistantReply(input);
}
