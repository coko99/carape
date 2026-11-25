ALTER TABLE "product_variants" ADD COLUMN "damaged_quantity" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "cost_minor" integer;
--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "reason" text;
--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "warehouse_id" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "channel" text DEFAULT 'retail' NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "company_id" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "bundle_discount_minor" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coupon_discount_minor" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "loyalty_discount_minor" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "loyalty_points" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "color" text;
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "allocated_discount_minor" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "cost_minor" integer;
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "bundle_id" text;
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"variant_id" text NOT NULL,
	"order_id" text,
	"quantity" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"pib" text NOT NULL,
	"registration_number" text NOT NULL,
	"line1" text NOT NULL,
	"city" text NOT NULL,
	"postal_code" text NOT NULL,
	"contact_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"website" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_terms_days" integer,
	"min_order_minor" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_lists" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_list_items" (
	"id" text PRIMARY KEY NOT NULL,
	"price_list_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"min_quantity" integer NOT NULL,
	"price_minor" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_list_items" (
	"id" text PRIMARY KEY NOT NULL,
	"list_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bundle_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"min_pairs" integer NOT NULL,
	"max_pairs" integer,
	"combine_with_coupons" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bundle_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"kind" text NOT NULL,
	"min_pairs" integer NOT NULL,
	"value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bundle_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"category_id" text,
	"product_id" text
);
--> statement-breakpoint
CREATE TABLE "cart_bundles" (
	"id" text PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_bundle_items" (
	"id" text PRIMARY KEY NOT NULL,
	"bundle_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_bundles" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"campaign_id" text,
	"name" text NOT NULL,
	"original_minor" integer NOT NULL,
	"discount_minor" integer NOT NULL,
	"final_minor" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"order_id" text,
	"type" text NOT NULL,
	"points" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"pending_after" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"reason" text NOT NULL,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"contact_name" text NOT NULL,
	"phone" text NOT NULL,
	"model_id" text NOT NULL,
	"model_name" text NOT NULL,
	"base_color" text NOT NULL,
	"accent_color" text,
	"logo_path" text,
	"logo_name" text,
	"placement" text DEFAULT 'lisnica' NOT NULL,
	"logo_x" integer DEFAULT 50 NOT NULL,
	"logo_y" integer DEFAULT 40 NOT NULL,
	"logo_scale" integer DEFAULT 30 NOT NULL,
	"quantity" integer NOT NULL,
	"size_breakdown" text NOT NULL,
	"packaging" text,
	"instructions" text,
	"status" text DEFAULT 'novi_upit' NOT NULL,
	"quote_minor" integer,
	"internal_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_events" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"token" text NOT NULL,
	"company_id" text,
	"design_id" text,
	"inquiry_id" text,
	"order_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_email" text NOT NULL,
	"buyer_pib" text,
	"buyer_address" text,
	"goods_minor" integer NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"shipping_minor" integer,
	"tax_minor" integer,
	"tax_note" text,
	"total_minor" integer NOT NULL,
	"payment_terms" text,
	"delivery_note" text,
	"notes" text,
	"valid_until" timestamp with time zone NOT NULL,
	"sent_snapshot" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_items" (
	"id" text PRIMARY KEY NOT NULL,
	"quotation_id" text NOT NULL,
	"variant_id" text,
	"description" text NOT NULL,
	"sku" text,
	"quantity" integer NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"line_total_minor" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_events" (
	"id" text PRIMARY KEY NOT NULL,
	"quotation_id" text NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_threads_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"role" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_list_id_shopping_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bundle_rules" ADD CONSTRAINT "bundle_rules_campaign_id_bundle_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."bundle_campaigns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bundle_targets" ADD CONSTRAINT "bundle_targets_campaign_id_bundle_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."bundle_campaigns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bundle_targets" ADD CONSTRAINT "bundle_targets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bundle_targets" ADD CONSTRAINT "bundle_targets_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cart_bundles" ADD CONSTRAINT "cart_bundles_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cart_bundles" ADD CONSTRAINT "cart_bundles_campaign_id_bundle_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."bundle_campaigns"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cart_bundle_items" ADD CONSTRAINT "cart_bundle_items_bundle_id_cart_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."cart_bundles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cart_bundle_items" ADD CONSTRAINT "cart_bundle_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_bundles" ADD CONSTRAINT "order_bundles_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "design_projects" ADD CONSTRAINT "design_projects_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "design_events" ADD CONSTRAINT "design_events_project_id_design_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."design_projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_design_id_design_projects_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."design_projects"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quotation_events" ADD CONSTRAINT "quotation_events_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "companies_pib_idx" ON "companies" USING btree ("pib");
--> statement-breakpoint
CREATE INDEX "companies_user_idx" ON "companies" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "price_tier_idx" ON "price_list_items" USING btree ("price_list_id","variant_id","min_quantity");
--> statement-breakpoint
CREATE INDEX "reservations_variant_idx" ON "stock_reservations" USING btree ("variant_id");
--> statement-breakpoint
CREATE INDEX "reservations_order_idx" ON "stock_reservations" USING btree ("order_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_idempotency_idx" ON "loyalty_ledger" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX "loyalty_user_idx" ON "loyalty_ledger" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "quotations_number_idx" ON "quotations" USING btree ("number");
--> statement-breakpoint
CREATE UNIQUE INDEX "quotations_token_idx" ON "quotations" USING btree ("token");
--> statement-breakpoint
CREATE INDEX "chat_thread_idx" ON "chat_messages" USING btree ("thread_id");
--> statement-breakpoint
INSERT INTO "site_settings" ("key", "value") VALUES ('quote_seq', '1000') ON CONFLICT ("key") DO NOTHING;
