import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: ts("createdAt").notNull(),
  updatedAt: ts("updatedAt").notNull(),
  role: text("role").notNull().default("customer"),
  banned: boolean("banned").notNull().default(false),
  banReason: text("banReason"),
  banExpires: ts("banExpires"),
  twoFactorEnabled: boolean("twoFactorEnabled").notNull().default(false),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: ts("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: ts("createdAt").notNull(),
  updatedAt: ts("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonatedBy"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: ts("accessTokenExpiresAt"),
  refreshTokenExpiresAt: ts("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: ts("createdAt").notNull(),
  updatedAt: ts("updatedAt").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expiresAt").notNull(),
  createdAt: ts("createdAt").notNull(),
  updatedAt: ts("updatedAt").notNull(),
});

export const twoFactor = pgTable("twoFactor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backupCodes").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  verified: boolean("verified").default(true),
  failedVerificationCount: integer("failedVerificationCount").default(0),
  lockedUntil: ts("lockedUntil"),
});

export const rateLimit = pgTable("rateLimit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("lastRequest", { mode: "number" }).notNull(),
});

export const customerProfiles = pgTable("customer_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  phone: text("phone"),
  companyName: text("company_name"),
  resellerStatus: text("reseller_status").notNull().default("none"),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  notes: text("notes"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const addresses = pgTable("addresses", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  label: text("label"),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  postalCode: text("postal_code").notNull(),
  country: text("country").notNull().default("RS"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    sourceId: integer("source_id"),
    sourceUrl: text("source_url"),
    parentId: text("parent_id"),
    slug: text("slug").notNull(),
    nameSr: text("name_sr").notNull(),
    nameEn: text("name_en"),
    descriptionSr: text("description_sr"),
    descriptionEn: text("description_en"),
    image: text("image"),
    sortOrder: integer("sort_order").notNull().default(0),
    seoTitleSr: text("seo_title_sr"),
    seoTitleEn: text("seo_title_en"),
    seoDescriptionSr: text("seo_description_sr"),
    seoDescriptionEn: text("seo_description_en"),
    status: text("status").notNull().default("published"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("categories_slug_idx").on(table.slug)],
);

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    sourceId: integer("source_id"),
    sourceUrl: text("source_url"),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    shortDescriptionSr: text("short_description_sr"),
    descriptionSr: text("description_sr"),
    descriptionEn: text("description_en"),
    material: text("material"),
    washing: text("washing"),
    status: text("status").notNull().default("published"),
    featured: boolean("featured").notNull().default(false),
    isNew: boolean("is_new").notNull().default(false),
    taxClass: text("tax_class").notNull().default("unverified"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("products_slug_idx").on(table.slug),
    index("products_status_idx").on(table.status),
    index("products_source_idx").on(table.sourceId),
  ],
);

export const productCategories = pgTable(
  "product_categories",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("product_categories_pk").on(table.productId, table.categoryId)],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sourceVariationId: integer("source_variation_id"),
    sku: text("sku"),
    size: text("size").notNull(),
    color: text("color"),
    priceMinor: integer("price_minor").notNull(),
    regularPriceMinor: integer("regular_price_minor").notNull(),
    salePriceMinor: integer("sale_price_minor"),
    stockQuantity: integer("stock_quantity"),
    reservedQuantity: integer("reserved_quantity").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    inStock: boolean("in_stock").notNull().default(true),
    damagedQuantity: integer("damaged_quantity").notNull().default(0),
    costMinor: integer("cost_minor"),
    stockState: text("stock_state").notNull().default("not_published"),
    status: text("status").notNull().default("published"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("variants_product_idx").on(table.productId),
    index("variants_sku_idx").on(table.sku),
    index("variants_color_idx").on(table.color),
    index("variants_size_idx").on(table.size),
  ],
);

export const productImages = pgTable("product_images", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  variantId: text("variant_id"),
  src: text("src").notNull(),
  sourceSrc: text("source_src"),
  alt: text("alt").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
});

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: text("id").primaryKey(),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    orderId: text("order_id"),
    actorId: text("actor_id"),
    type: text("type").notNull(),
    quantityDelta: integer("quantity_delta").notNull(),
    stockAfter: integer("stock_after"),
    reason: text("reason"),
    warehouseId: text("warehouse_id"),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (table) => [index("inventory_variant_idx").on(table.variantId)],
);

export const carts = pgTable("carts", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("user_id"),
  currency: text("currency").notNull().default("RSD"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    id: text("id").primaryKey(),
    cartId: text("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariants.id),
    quantity: integer("quantity").notNull(),
  },
  (table) => [uniqueIndex("cart_variant_idx").on(table.cartId, table.variantId)],
);

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    userId: text("user_id"),
    email: text("email").notNull(),
    status: text("status").notNull().default("placed"),
    paymentMethod: text("payment_method").notNull(),
    paymentStatus: text("payment_status").notNull().default("unpaid"),
    currency: text("currency").notNull().default("RSD"),
    goodsMinor: integer("goods_minor").notNull(),
    discountMinor: integer("discount_minor").notNull().default(0),
    shippingMinor: integer("shipping_minor"),
    shippingStatus: text("shipping_status").notNull(),
    taxMinor: integer("tax_minor"),
    taxNote: text("tax_note"),
    totalKnown: boolean("total_known").notNull(),
    totalMinor: integer("total_minor").notNull(),
    couponCode: text("coupon_code"),
    channel: text("channel").notNull().default("retail"),
    companyId: text("company_id"),
    bundleDiscountMinor: integer("bundle_discount_minor").notNull().default(0),
    couponDiscountMinor: integer("coupon_discount_minor").notNull().default(0),
    loyaltyDiscountMinor: integer("loyalty_discount_minor").notNull().default(0),
    loyaltyPoints: integer("loyalty_points").notNull().default(0),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    postalCode: text("postal_code").notNull(),
    country: text("country").notNull().default("RS"),
    customerNote: text("customer_note"),
    internalNote: text("internal_note"),
    locale: text("locale").notNull().default("sr"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_number_idx").on(table.number),
    uniqueIndex("orders_idempotency_idx").on(table.idempotencyKey),
    index("orders_status_idx").on(table.status),
    index("orders_email_idx").on(table.email),
    index("orders_created_idx").on(table.createdAt),
  ],
);

export const orderItems = pgTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  variantId: text("variant_id"),
  productName: text("product_name").notNull(),
  sku: text("sku"),
  size: text("size").notNull(),
  color: text("color"),
  quantity: integer("quantity").notNull(),
  unitPriceMinor: integer("unit_price_minor").notNull(),
  lineTotalMinor: integer("line_total_minor").notNull(),
  allocatedDiscountMinor: integer("allocated_discount_minor").notNull().default(0),
  costMinor: integer("cost_minor"),
  bundleId: text("bundle_id"),
  stockState: text("stock_state").notNull(),
});

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  method: text("method").notNull(),
  status: text("status").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  refundedMinor: integer("refunded_minor").notNull().default(0),
  provider: text("provider"),
  providerRef: text("provider_ref"),
  note: text("note"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const shipments = pgTable("shipments", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  method: text("method").notNull(),
  status: text("status").notNull(),
  priceMinor: integer("price_minor"),
  carrier: text("carrier"),
  trackingNumber: text("tracking_number"),
  shippedAt: ts("shipped_at"),
  deliveredAt: ts("delivered_at"),
});

export const coupons = pgTable("coupons", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: text("type").notNull(),
  value: integer("value").notNull(),
  minGoodsMinor: integer("min_goods_minor"),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").notNull().default(0),
  startsAt: ts("starts_at"),
  endsAt: ts("ends_at"),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const couponRedemptions = pgTable("coupon_redemptions", {
  id: text("id").primaryKey(),
  couponId: text("coupon_id")
    .notNull()
    .references(() => coupons.id),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  amountMinor: integer("amount_minor").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  authorName: text("author_name").notNull(),
  rating: integer("rating").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("pending"),
  verifiedPurchase: boolean("verified_purchase").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const inquiries = pgTable("inquiries", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  status: text("status").notNull().default("new"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  organization: text("organization"),
  quantities: text("quantities"),
  interests: text("interests"),
  message: text("message").notNull(),
  filePath: text("file_path"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const newsletterConsents = pgTable("newsletter_consents", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  locale: text("locale").notNull(),
  consented: boolean("consented").notNull(),
  source: text("source").notNull(),
  ip: text("ip"),
  consentedAt: ts("consented_at").notNull().defaultNow(),
  unsubscribedAt: ts("unsubscribed_at"),
});

export const media = pgTable("media", {
  id: text("id").primaryKey(),
  path: text("path").notNull(),
  alt: text("alt"),
  kind: text("kind").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const cmsPages = pgTable(
  "cms_pages",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    locale: text("locale").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    kind: text("kind").notNull().default("page"),
    legalReview: boolean("legal_review").notNull().default(false),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("cms_slug_locale_idx").on(table.slug, table.locale)],
);

export const faqs = pgTable("faqs", {
  id: text("id").primaryKey(),
  locale: text("locale").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(true),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    metadata: text("metadata"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (table) => [index("audit_created_idx").on(table.createdAt)],
);

export const importJobs = pgTable("import_jobs", {
  id: text("id").primaryKey(),
  actorId: text("actor_id"),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  summary: text("summary").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const emailOutbox = pgTable("email_outbox", {
  id: text("id").primaryKey(),
  toAddress: text("to_address").notNull(),
  template: text("template").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  relatedId: text("related_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    token: text("token"),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (table) => [index("wishlist_token_idx").on(table.token), index("wishlist_user_idx").on(table.userId)],
);

export const redirects = pgTable("redirects", {
  id: text("id").primaryKey(),
  source: text("source").notNull().unique(),
  destination: text("destination").notNull(),
  permanent: boolean("permanent").notNull().default(true),
});

export const warehouses = pgTable("warehouses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const stockReservations = pgTable(
  "stock_reservations",
  {
    id: text("id").primaryKey(),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariants.id),
    orderId: text("order_id").references(() => orders.id),
    quantity: integer("quantity").notNull(),
    status: text("status").notNull().default("active"),
    expiresAt: ts("expires_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (table) => [index("reservations_variant_idx").on(table.variantId), index("reservations_order_idx").on(table.orderId)],
);

export const companies = pgTable(
  "companies",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id),
    name: text("name").notNull(),
    pib: text("pib").notNull(),
    registrationNumber: text("registration_number").notNull(),
    line1: text("line1").notNull(),
    city: text("city").notNull(),
    postalCode: text("postal_code").notNull(),
    contactName: text("contact_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    website: text("website"),
    status: text("status").notNull().default("pending"),
    paymentTermsDays: integer("payment_terms_days"),
    minOrderMinor: integer("min_order_minor"),
    notes: text("notes"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("companies_pib_idx").on(table.pib), index("companies_user_idx").on(table.userId)],
);

export const priceLists = pgTable("price_lists", {
  id: text("id").primaryKey(),
  companyId: text("company_id").references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const priceListItems = pgTable(
  "price_list_items",
  {
    id: text("id").primaryKey(),
    priceListId: text("price_list_id")
      .notNull()
      .references(() => priceLists.id, { onDelete: "cascade" }),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    minQuantity: integer("min_quantity").notNull(),
    priceMinor: integer("price_minor").notNull(),
  },
  (table) => [uniqueIndex("price_tier_idx").on(table.priceListId, table.variantId, table.minQuantity)],
);

export const shoppingLists = pgTable("shopping_lists", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const shoppingListItems = pgTable("shopping_list_items", {
  id: text("id").primaryKey(),
  listId: text("list_id")
    .notNull()
    .references(() => shoppingLists.id, { onDelete: "cascade" }),
  variantId: text("variant_id")
    .notNull()
    .references(() => productVariants.id),
  quantity: integer("quantity").notNull(),
});

export const bundleCampaigns = pgTable("bundle_campaigns", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(false),
  minPairs: integer("min_pairs").notNull(),
  maxPairs: integer("max_pairs"),
  combineWithCoupons: boolean("combine_with_coupons").notNull().default(false),
  startsAt: ts("starts_at"),
  endsAt: ts("ends_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const bundleRules = pgTable("bundle_rules", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => bundleCampaigns.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  minPairs: integer("min_pairs").notNull(),
  value: integer("value").notNull(),
});

export const bundleTargets = pgTable("bundle_targets", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => bundleCampaigns.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => categories.id),
  productId: text("product_id").references(() => products.id),
});

export const cartBundles = pgTable("cart_bundles", {
  id: text("id").primaryKey(),
  cartId: text("cart_id")
    .notNull()
    .references(() => carts.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => bundleCampaigns.id),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const cartBundleItems = pgTable("cart_bundle_items", {
  id: text("id").primaryKey(),
  bundleId: text("bundle_id")
    .notNull()
    .references(() => cartBundles.id, { onDelete: "cascade" }),
  variantId: text("variant_id")
    .notNull()
    .references(() => productVariants.id),
  quantity: integer("quantity").notNull(),
});

export const orderBundles = pgTable("order_bundles", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id"),
  name: text("name").notNull(),
  originalMinor: integer("original_minor").notNull(),
  discountMinor: integer("discount_minor").notNull(),
  finalMinor: integer("final_minor").notNull(),
});

export const loyaltyLedger = pgTable(
  "loyalty_ledger",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    orderId: text("order_id").references(() => orders.id),
    type: text("type").notNull(),
    points: integer("points").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    pendingAfter: integer("pending_after").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    reason: text("reason").notNull(),
    actorId: text("actor_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("loyalty_idempotency_idx").on(table.idempotencyKey), index("loyalty_user_idx").on(table.userId)],
);

export const designProjects = pgTable("design_projects", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id),
  email: text("email").notNull(),
  contactName: text("contact_name").notNull(),
  phone: text("phone").notNull(),
  modelId: text("model_id").notNull(),
  modelName: text("model_name").notNull(),
  baseColor: text("base_color").notNull(),
  accentColor: text("accent_color"),
  logoPath: text("logo_path"),
  logoName: text("logo_name"),
  placement: text("placement").notNull().default("lisnica"),
  logoX: integer("logo_x").notNull().default(50),
  logoY: integer("logo_y").notNull().default(40),
  logoScale: integer("logo_scale").notNull().default(30),
  quantity: integer("quantity").notNull(),
  sizeBreakdown: text("size_breakdown").notNull(),
  packaging: text("packaging"),
  instructions: text("instructions"),
  status: text("status").notNull().default("novi_upit"),
  quoteMinor: integer("quote_minor"),
  internalNote: text("internal_note"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const designEvents = pgTable("design_events", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => designProjects.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  note: text("note"),
  actorId: text("actor_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const quotations = pgTable(
  "quotations",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull(),
    token: text("token").notNull(),
    companyId: text("company_id").references(() => companies.id),
    designId: text("design_id").references(() => designProjects.id),
    inquiryId: text("inquiry_id").references(() => inquiries.id),
    orderId: text("order_id"),
    status: text("status").notNull().default("draft"),
    buyerName: text("buyer_name").notNull(),
    buyerEmail: text("buyer_email").notNull(),
    buyerPib: text("buyer_pib"),
    buyerAddress: text("buyer_address"),
    goodsMinor: integer("goods_minor").notNull(),
    discountMinor: integer("discount_minor").notNull().default(0),
    shippingMinor: integer("shipping_minor"),
    taxMinor: integer("tax_minor"),
    taxNote: text("tax_note"),
    totalMinor: integer("total_minor").notNull(),
    paymentTerms: text("payment_terms"),
    deliveryNote: text("delivery_note"),
    notes: text("notes"),
    validUntil: ts("valid_until").notNull(),
    sentSnapshot: text("sent_snapshot"),
    createdBy: text("created_by"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("quotations_number_idx").on(table.number), uniqueIndex("quotations_token_idx").on(table.token)],
);

export const quotationItems = pgTable("quotation_items", {
  id: text("id").primaryKey(),
  quotationId: text("quotation_id")
    .notNull()
    .references(() => quotations.id, { onDelete: "cascade" }),
  variantId: text("variant_id"),
  description: text("description").notNull(),
  sku: text("sku"),
  quantity: integer("quantity").notNull(),
  unitPriceMinor: integer("unit_price_minor").notNull(),
  discountMinor: integer("discount_minor").notNull().default(0),
  lineTotalMinor: integer("line_total_minor").notNull(),
});

export const quotationEvents = pgTable("quotation_events", {
  id: text("id").primaryKey(),
  quotationId: text("quotation_id")
    .notNull()
    .references(() => quotations.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  note: text("note"),
  actorId: text("actor_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const chatThreads = pgTable("chat_threads", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("user_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const catalogColors = pgTable("catalog_colors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  hex: text("hex"),
  sortOrder: integer("sort_order").notNull().default(0),
  visible: boolean("visible").notNull().default(true),
});

export const catalogSizes = pgTable("catalog_sizes", {
  label: text("label").primaryKey(),
  sortOrder: integer("sort_order").notNull().default(0),
  visible: boolean("visible").notNull().default(true),
});

export const catalogTypePrefs = pgTable("catalog_type_prefs", {
  categoryId: text("category_id")
    .primaryKey()
    .references(() => categories.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  visible: boolean("visible").notNull().default(true),
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    body: text("body").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (table) => [index("chat_thread_idx").on(table.threadId)],
);
