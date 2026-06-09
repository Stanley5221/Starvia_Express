-- CreateTable
CREATE TABLE "DispatchConfig" (
    "id" TEXT NOT NULL,
    "radiusKm" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "fallbackSecs" INTEGER NOT NULL DEFAULT 90,
    "locationFreshMins" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "DispatchConfig_pkey" PRIMARY KEY ("id")
);
