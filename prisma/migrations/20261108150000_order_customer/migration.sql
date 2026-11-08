-- Link orders to the logged-in customer (Supabase Auth user id)
ALTER TABLE "Order" ADD COLUMN "customerId" TEXT;
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
