# Photo storage (character images)

Character photos uploaded in the admin console (Characters → Edit) are cropped and compressed to WebP automatically: the profile photo to 600×600 and the cover to 1200 wide.

**Where the photos are stored:**
- **Without any setup:** in `apps/api/uploads`, served at `/media`. That's fine on your laptop. On Render the files are **lost on every deploy**, so set up R2 before launch.
- **With Cloudflare R2:** in the cloud. R2 is S3-compatible, has a free tier of 10 GB, and charges nothing for downloads.

## Set up Cloudflare R2 (about 10 minutes)
1. **Create a bucket.** Sign up at cloudflare.com, then go to **R2 → Create bucket**, for example `lovira-media`.
2. **Make the bucket public.** Open the bucket, go to **Settings → Public access**, and either turn on the `r2.dev` URL or connect your own domain (for example `media.lovira.app`). Copy that public URL.
3. **Create an API token.** Go to **R2 → Manage R2 API tokens → Create API token**, with permission "Object Read & Write" for this bucket. Copy the **Access Key ID**, the **Secret Access Key** and the **S3 endpoint** (`https://<account-id>.r2.cloudflarestorage.com`).
4. **Add these to the server's environment** (Render, and `.env`):
   ```
   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_BUCKET=lovira-media
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   MEDIA_PUBLIC_URL=https://media.lovira.app   # the public URL from step 2
   ```
5. **Restart the server.** New uploads now go to R2: the admin panel says "Saved to cloud storage". After that, re-upload any photos you added while storage was local.

Without R2, set `PUBLIC_API_URL` to the server's public address (for example `https://ai-let.onrender.com`), so local `/media` links work from phones.
