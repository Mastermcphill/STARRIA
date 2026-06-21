-- Add size (bytes) to MediaUpload — needed for presigned-upload flow metadata.
ALTER TABLE "MediaUpload" ADD COLUMN "size" INTEGER;
