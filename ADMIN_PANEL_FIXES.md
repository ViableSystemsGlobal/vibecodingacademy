# 🔧 Admin Panel Fixes

## Issues Fixed

### 1. ✅ Logo Upload URL Issue

**Problem:**
- Logo URLs were saved as `http://localhost:3005/uploads/...`
- Frontend tried to load from `http://vibecoding.africa/uploads/...`
- Logo failed to load with "Failed to load logo" error

**Fix:**
- Updated logo upload to use production API domain
- In production: Uses `https://api.vibecoding.africa`
- In development: Uses request host or localhost
- Logo URLs now correctly point to the backend API

**File:** `backend/src/routes/admin/settings.routes.ts`

---

### 2. ✅ Payment Status Mismatch

**Problem:**
- Payments showed as "PAID" in `/admin/payments`
- But registrations showed "PENDING" in `/admin/registrations`
- Payment was completed but registration status wasn't updated

**Fix:**
- After creating payment records, now updates registration `paymentStatus` to `PAID`
- Both payments and registrations now show consistent status

**File:** `backend/src/services/payment.service.ts`

**Code Added:**
```typescript
// Update registration payment status to PAID
await prisma.registration.update({
  where: { id: registration.id },
  data: {
    paymentStatus: 'PAID',
  },
});
```

---

### 3. ⚠️ Course Edit 404 Issue

**Status:** Route exists and is properly registered

**Backend Route:**
- `PUT /admin/courses/:id` - ✅ Registered
- Located in: `backend/src/routes/admin/courses.routes.ts`

**Frontend Call:**
- `PUT /admin/courses/${courseId}` - ✅ Correct

**Possible Causes:**
1. **Course doesn't exist** - Check if the course ID is valid
2. **Authentication issue** - Verify admin is logged in
3. **Frontend routing** - Check browser network tab for actual request URL

**Debugging Steps:**
1. Open browser DevTools → Network tab
2. Try to edit a course
3. Check the actual request URL and response
4. Verify the course ID exists in the database

**If still getting 404:**
- Check backend logs for the actual request
- Verify the course ID in the URL matches an existing course
- Check if there's a route conflict or middleware issue

---

## Testing

### Test Logo Upload:
1. Go to Admin → Settings → App Settings
2. Upload a logo
3. Check that the logo URL uses `https://api.vibecoding.africa/uploads/...`
4. Verify logo displays correctly

### Test Payment Status:
1. Make a test payment
2. Check `/admin/payments` - should show PAID
3. Check `/admin/registrations` - should also show PAID (not PENDING)

### Test Course Edit:
1. Go to Admin → Courses
2. Click edit on an existing course
3. If 404, check:
   - Browser console for errors
   - Network tab for actual request
   - Backend logs for the request

---

## Deployment

All fixes are committed and pushed. After redeploying:

1. **Logo uploads** will use correct production URLs
2. **Payment status** will be consistent between payments and registrations
3. **Course edit** route exists - if still 404, check debugging steps above

---

## Summary

✅ **Fixed:** Logo upload URL  
✅ **Fixed:** Payment status mismatch  
⚠️ **Needs Investigation:** Course edit 404 (route exists, might be frontend or data issue)
