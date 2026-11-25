import { z } from "zod";

const phone = z.string().trim().regex(/^(\+381|0)[0-9\s/-]{8,16}$/);

export const checkoutSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(80),
  email: z.email(),
  name: z.string().trim().min(3).max(120),
  phone,
  line1: z.string().trim().min(4).max(160),
  line2: z.string().trim().max(160).optional(),
  city: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().regex(/^\d{5}$/),
  note: z.string().trim().max(500).optional(),
  paymentMethod: z.enum(["cod", "bank_transfer"]),
  couponCode: z.string().trim().max(40).optional(),
  loyaltyPoints: z.number().int().min(0).max(1_000_000).optional(),
  locale: z.enum(["sr", "en"]),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(3).max(120),
  email: z.email(),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(10).max(2000),
});

export const wholesaleSchema = contactSchema.extend({
  organization: z.string().trim().min(2).max(160),
  quantities: z.string().trim().max(300).optional(),
  interests: z.string().trim().max(300).optional(),
});

export const newsletterSchema = z.object({
  email: z.email(),
  consent: z.literal(true),
  locale: z.enum(["sr", "en"]),
});
