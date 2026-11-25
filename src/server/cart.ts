import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { requireDb } from "@/db";
import { cartBundles, cartItems, carts, productVariants, products } from "@/db/schema";
import { decodeBasicEntities } from "@/lib/text";

export const CART_COOKIE = "zajo_cart";

export async function getCartToken() {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

export async function ensureCart() {
  const db = await requireDb();
  const store = await cookies();
  const existing = store.get(CART_COOKIE)?.value;
  if (existing) {
    const [cart] = await db.select().from(carts).where(eq(carts.token, existing));
    if (cart) return cart;
  }
  const token = crypto.randomUUID();
  const cart = {
    id: crypto.randomUUID(),
    token,
    currency: "RSD",
    updatedAt: new Date(),
    createdAt: new Date(),
  };
  await db.insert(carts).values(cart);
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return cart;
}

export async function getCartLines() {
  const token = await getCartToken();
  if (!token) return [];
  const db = await requireDb();
  const [cart] = await db.select().from(carts).where(eq(carts.token, token));
  if (!cart) return [];
  const rows = await db
    .select({
      itemId: cartItems.id,
      quantity: cartItems.quantity,
      variantId: productVariants.id,
      size: productVariants.size,
      sku: productVariants.sku,
      priceMinor: productVariants.priceMinor,
      regularPriceMinor: productVariants.regularPriceMinor,
      inStock: productVariants.inStock,
      stockQuantity: productVariants.stockQuantity,
      reservedQuantity: productVariants.reservedQuantity,
      stockState: productVariants.stockState,
      productId: products.id,
      slug: products.slug,
      name: products.name,
      status: products.status,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(cartItems.cartId, cart.id));
  return rows
    .filter((row) => row.status === "published")
    .map((row) => ({ ...row, name: decodeBasicEntities(row.name) }));
}

export async function addCartItem(variantId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return { ok: false as const, error: "quantity" };
  }
  const db = await requireDb();
  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, variantId));
  if (!variant || variant.status !== "published") return { ok: false as const, error: "variant" };
  const cart = await ensureCart();
  const [existing] = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variantId)));
  const nextQuantity = Math.min(99, (existing?.quantity ?? 0) + quantity);
  if (existing) {
    await db.update(cartItems).set({ quantity: nextQuantity }).where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({
      id: crypto.randomUUID(),
      cartId: cart.id,
      variantId,
      quantity: nextQuantity,
    });
  }
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cart.id));
  return { ok: true as const };
}

export async function updateCartItem(itemId: string, quantity: number) {
  const token = await getCartToken();
  if (!token) return { ok: false as const, error: "cart" };
  const db = await requireDb();
  const [cart] = await db.select().from(carts).where(eq(carts.token, token));
  if (!cart) return { ok: false as const, error: "cart" };
  if (quantity <= 0) {
    await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
  } else {
    await db
      .update(cartItems)
      .set({ quantity: Math.min(99, quantity) })
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
  }
  return { ok: true as const };
}

export async function clearCart(cartId: string) {
  const db = await requireDb();
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
  await db.delete(cartBundles).where(eq(cartBundles.cartId, cartId));
}
