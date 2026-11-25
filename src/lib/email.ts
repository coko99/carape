import { Resend } from "resend";
import { requireDb } from "@/db";
import { emailOutbox } from "@/db/schema";

export async function sendTransactional(input: {
  to: string;
  template: string;
  subject: string;
  body: string;
  relatedId?: string;
}) {
  const id = crypto.randomUUID();
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    const db = await requireDb();
    await db.insert(emailOutbox).values({
      id,
      toAddress: input.to,
      template: input.template,
      subject: input.subject,
      body: input.body,
      status: "skipped_unconfigured",
      error: "RESEND_API_KEY or EMAIL_FROM is not set",
      relatedId: input.relatedId,
    });
    return { id, delivered: false as const, status: "skipped_unconfigured" as const };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
    const db = await requireDb();
    await db.insert(emailOutbox).values({
      id,
      toAddress: input.to,
      template: input.template,
      subject: input.subject,
      body: input.body,
      status: result.error ? "failed" : "sent",
      error: result.error ? result.error.message : null,
      relatedId: input.relatedId,
    });
    return { id, delivered: !result.error, status: result.error ? "failed" : "sent" };
  } catch (error) {
    const db = await requireDb();
    await db.insert(emailOutbox).values({
      id,
      toAddress: input.to,
      template: input.template,
      subject: input.subject,
      body: input.body,
      status: "failed",
      error: error instanceof Error ? error.message : "send failed",
      relatedId: input.relatedId,
    });
    return { id, delivered: false as const, status: "failed" as const };
  }
}
