-- AlterTable
ALTER TABLE "Rider" ADD COLUMN     "pushToken" TEXT;

-- CreateIndex
CREATE INDEX "Rider_isApproved_isAvailable_isOnDelivery_isSuspended_lastL_idx" ON "Rider"("isApproved", "isAvailable", "isOnDelivery", "isSuspended", "lastLat", "lastLng");
