-- Optional date a delivery schedule phase becomes sold out (set by the admin per phase)
ALTER TABLE "EventSchedule" ADD COLUMN "soldOutAt" TIMESTAMP(3);
