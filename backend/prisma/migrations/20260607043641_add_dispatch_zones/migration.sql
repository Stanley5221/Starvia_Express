-- CreateTable
CREATE TABLE "DispatchZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLng" DOUBLE PRECISION NOT NULL,
    "zoneBoundaryKm" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "dispatchRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispatchZone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DispatchZone_isActive_idx" ON "DispatchZone"("isActive");
