# Fix WhatsApp Sharing Preview

## Problem
When sharing links on WhatsApp, you see a generic browser overlay instead of a proper preview card with title, description, and image.

## Solution

### Step 1: Set SEO Settings in Admin Panel

1. Go to **Settings → Ecommerce → SEO**
2. Fill in the following fields:

   **Basic SEO:**
   - **Meta Title**: Your store name (e.g., "The POOLSHOP - Premium Pool Supplies")
   - **Meta Description**: A compelling description (e.g., "Shop premium pool supplies, equipment, and accessories. Fast delivery across Ghana.")
   - **Meta Keywords**: Comma-separated keywords (e.g., "pool supplies, pool equipment, swimming pool")
   - **Canonical URL**: `https://store.thepoolshop.africa`

   **Open Graph (for social sharing):**
   - **OG Title**: Same as Meta Title or a catchy headline
   - **OG Description**: Same as Meta Description or a shorter version
   - **OG Image**: Upload a high-quality image (1200x630px recommended)
     - This image will appear when sharing on WhatsApp, Facebook, Twitter, etc.
     - If not set, it will fallback to your company logo

   **Twitter:**
   - **Twitter Handle**: Your Twitter username (optional)

3. **Save** the settings

### Step 2: Set Environment Variables (if not already set)

In EasyPanel, make sure these environment variables are set:

```env
NEXT_PUBLIC_APP_URL=https://store.thepoolshop.africa
NEXTAUTH_URL=https://store.thepoolshop.africa
```

### Step 3: Clear WhatsApp Cache

WhatsApp caches link previews. To see the new preview:

1. **Option A**: Use WhatsApp's link preview debugger
   - Share the link in a new chat
   - WhatsApp will fetch fresh metadata

2. **Option B**: Add a cache-busting parameter
   - Share: `https://store.thepoolshop.africa/?v=2`
   - This forces WhatsApp to fetch new metadata

3. **Option C**: Wait 24-48 hours
   - WhatsApp cache expires after some time

### Step 4: Verify Metadata

To check if metadata is correct, use these tools:

1. **Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/
   - Enter your URL
   - Click "Scrape Again" to clear cache
   - Check the preview

2. **Twitter Card Validator**: https://cards-dev.twitter.com/validator
   - Enter your URL
   - Check the preview

3. **LinkedIn Post Inspector**: https://www.linkedin.com/post-inspector/
   - Enter your URL
   - Check the preview

### What Was Fixed

✅ **OG Image Fallback**: If no OG image is set, it now uses your company logo  
✅ **Absolute URLs**: All OG image URLs are now converted to absolute URLs  
✅ **Base URL Detection**: Better detection of the correct domain  
✅ **Complete Metadata**: Added siteName, locale, and image dimensions to Open Graph tags

### Important Notes

- **OG Image Requirements**:
  - Recommended size: 1200x630px
  - Minimum size: 600x315px
  - Format: JPG or PNG
  - File size: Under 8MB

- **Canonical URL**: Should match your actual domain (store.thepoolshop.africa)

- **Cache**: Social media platforms cache link previews. Changes may take time to appear.

## Quick Checklist

- [ ] Set Meta Title in SEO settings
- [ ] Set Meta Description in SEO settings
- [ ] Set Canonical URL to `https://store.thepoolshop.africa`
- [ ] Upload OG Image (1200x630px recommended)
- [ ] Set OG Title and Description
- [ ] Verify environment variables are set
- [ ] Test with Facebook Sharing Debugger
- [ ] Clear WhatsApp cache by sharing in new chat

