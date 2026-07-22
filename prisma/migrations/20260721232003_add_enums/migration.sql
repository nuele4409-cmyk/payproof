-- CreateEnum
CREATE TYPE "Role" AS ENUM ('buyer', 'seller');

-- CreateEnum
CREATE TYPE "OrderState" AS ENUM ('PendingPayment', 'Paid', 'AwaitingShipment', 'Shipped', 'Delivered', 'Completed');

-- Drop old indexes that reference the old state column
-- (they'll be recreated below)
DROP INDEX IF EXISTS "Order_state_idx";
DROP INDEX IF EXISTS "Order_sellerId_state_idx";

-- Convert User.role from text to enum (values match exactly)
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");

-- Convert Order.state from text to enum with value mapping
ALTER TABLE "Order" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "state" TYPE "OrderState" USING (
  CASE "state"
    WHEN 'Pending Payment' THEN 'PendingPayment'::"OrderState"
    WHEN 'Awaiting Shipment' THEN 'AwaitingShipment'::"OrderState"
    ELSE "state"::text::"OrderState"
  END
);
ALTER TABLE "Order" ALTER COLUMN "state" SET DEFAULT 'PendingPayment';

-- Recreate indexes
CREATE INDEX "Order_state_idx" ON "Order"("state");
CREATE INDEX "Order_sellerId_state_idx" ON "Order"("sellerId", "state");
CREATE INDEX "User_role_idx" ON "User"("role");
