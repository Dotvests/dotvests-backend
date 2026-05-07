# Smile Identity Integration - Refactor Summary

## What Changed

The Smile Identity integration was refactored from a **backend-heavy** approach to a **frontend-SDK** approach.

### Before (Backend-Heavy)
```
Frontend collects BVN, NIN, document, selfie (base64)
  ↓
Backend POSTs all data to Smile API
  ↓
Backend polls Smile for status
  ↓
Smile webhook updates backend
```

**Issues:**
- Frontend sends large base64 images (bandwidth)
- Backend makes API calls to Smile (slower, adds latency)
- Poor user experience (no real-time feedback, no liveness detection)
- Smile's SDK features not used

---

### After (Frontend-SDK)
```
Frontend opens Smile SDK WebView
  ├─ User does liveness check (real-time)
  ├─ User scans document (OCR, quality checks)
  └─ User gets instant feedback
  ↓
Frontend receives job_id from Smile SDK
  ↓
Frontend sends only job_id to backend (small payload)
  ↓
Smile webhook notifies backend of result
  ↓
Backend updates kyc_status
```

**Benefits:**
- Better UX (native camera, real-time feedback)
- Smaller payload (just job_id, not images)
- Smile handles all verification logic
- Compliance ready (liveness detection)
- Faster development (frontend, backend sync up later)

---

## Backend Changes

### routes/kyc.js

**POST /api/kyc/submit** (Changed)
- **Before:** Accepted BVN, NIN, document_type, document_number, address, selfie_image
- **Now:** Accepts only `smile_job_id`
- **Why:** Frontend has already completed verification via Smile SDK

```javascript
// Before
const { bvn, nin, document_type, document_number, address, selfie_image } = req.body;
// Call Smile API to create job...
// Update user with all fields...

// After
const { smile_job_id } = req.body;
// Just store the job_id
db.prepare('UPDATE users SET smile_job_id = ?, kyc_status = ?').run(smile_job_id, 'pending');
```

**GET /api/kyc/status** (Simplified)
- **Before:** Called Smile API to check job status, updated DB if approved
- **Now:** Just returns current status from DB
- **Why:** Smile webhook handles updates, no need to poll

```javascript
// Before
if (user.kyc_status === 'pending') {
  const smileResponse = await axios.get(`https://api.usesmile.io/v1/jobs/${job_id}`);
  // Update DB based on response...
}

// After
return user.kyc_status; // Just return what we have
```

**POST /api/kyc/webhook** (Enhanced)
- **Before:** Accepted webhook with minimal validation
- **Now:** Validates Smile signature (HMAC-SHA256)
- **Why:** Security - ensure webhook is actually from Smile

```javascript
// Now validates signature
const expectedSignature = crypto
  .createHmac('sha256', secret)
  .update(rawBody)
  .digest('hex');

if (signature !== expectedSignature) {
  return res.status(200).json({ received: true }); // Ignore
}
```

**Removed:**
- `axios` import (no longer calling Smile API from backend)
- Smile API calls in `/submit` endpoint
- Smile API polling in `/status` endpoint

---

## Frontend Responsibilities

Frontend now handles:
1. **Smile SDK Integration** — Show Smile WebView/modal
2. **Liveness Detection** — Smile SDK handles this natively
3. **Document Capture** — Smile SDK handles this natively
4. **User Feedback** — Real-time progress from Smile SDK
5. **Send job_id** — POST to `/api/kyc/submit`
6. **Poll for Result** — GET `/api/kyc/status` every 10 seconds

See [SMILE_SDK_FRONTEND_INTEGRATION.md](SMILE_SDK_FRONTEND_INTEGRATION.md) for complete frontend implementation.

---

## Endpoint Summary

| Endpoint | Before | After | Purpose |
|----------|--------|-------|---------|
| `POST /api/kyc/submit` | Full KYC form | Just `smile_job_id` | Register Smile job with backend |
| `GET /api/kyc/status` | Calls Smile API | Just DB query | Check verification status |
| `POST /api/kyc/webhook` | Basic validation | HMAC validation | Smile notifies of result |

---

## Database

No schema changes needed. Uses existing columns:
- `smile_job_id` — Stores the Smile job ID
- `kyc_status` — unverified → pending → verified/rejected
- `kyc_submitted_at` — When user submitted to Smile
- `liveness_passed` — Set to 1 when approved

---

## Environment Variables

No changes to backend `.env`:

```env
SMILE_API_KEY=your_smile_api_key  # Used for webhook signature validation
SMILE_PARTNER_ID=your_smile_partner_id  # Used by frontend only
```

Frontend needs:
```env
REACT_APP_SMILE_PARTNER_ID=your_smile_partner_id
```

---

## Testing Workflow

### For Backend Team (Before Frontend is Ready)

1. **User manually sets kyc_status in DB:**
   ```bash
   sqlite3 db/dotvests.db "UPDATE users SET kyc_status = 'verified' WHERE id = 1;"
   ```

2. **Test wallet creation:**
   ```bash
   curl -X POST "http://localhost:3000/api/wallet/create" \
     -H "Authorization: Bearer $TOKEN"
   ```

3. **Verify it works** (should create DVA)

### For Frontend Team (After Backend is Ready)

1. **Integrate Smile SDK** (see guide)
2. **Test complete flow:**
   - User completes Smile verification
   - Frontend gets `job_id`
   - Frontend sends to `/api/kyc/submit`
   - Frontend polls `/api/kyc/status`
   - Smile webhook fires (simulate locally if needed)
   - Backend updates `kyc_status`
   - Frontend sees "verified" and shows wallet button

### For QA (End-to-End)

1. User registers
2. Clicks "Start KYC"
3. Completes Smile verification
4. Backend receives webhook and updates status
5. User sees "verified" notification
6. User can create wallet

---

## Smile Webhook Testing

### Local Testing (Without Real Smile Account)

Simulate the webhook:

```bash
curl -X POST "http://localhost:3000/api/kyc/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Smile-Signature: (skip in dev mode)" \
  -d '{
    "job_id": "job_test_123",
    "user_id": 1,
    "result": {
      "status": "Approved"
    }
  }'
```

**Note:** In development, you may want to skip signature validation. In production, always validate.

---

## Signature Validation

Smile sends webhook with HMAC-SHA256 signature:

```
X-Smile-Signature: sha256_hash_of_body
```

Backend validates:
```javascript
const secret = process.env.SMILE_API_KEY;
const expectedSignature = crypto
  .createHmac('sha256', secret)
  .update(JSON.stringify(req.body))
  .digest('hex');

if (signature !== expectedSignature) {
  // Invalid, reject webhook
}
```

---

## Migration Steps

1. **Backend Refactor** ✅ (Done)
   - Simplified `/submit` endpoint
   - Removed Smile API calls
   - Added signature validation

2. **Frontend Implementation** (TODO)
   - Integrate Smile SDK
   - Handle liveness + document capture
   - Send `job_id` to backend
   - Poll for verification status

3. **Testing** (TODO)
   - Manual testing with mock webhooks
   - End-to-end testing with real Smile account
   - Load testing for webhook handling

4. **Deployment** (TODO)
   - Deploy backend changes
   - Deploy frontend with Smile SDK
   - Configure Smile webhook URL pointing to production

---

## Smile API Documentation

- **Web SDK:** https://docs.usesmile.io/web
- **React Native:** https://docs.usesmile.io/react-native
- **iOS:** https://docs.usesmile.io/ios
- **Android:** https://docs.usesmile.io/android
- **Webhook Docs:** https://docs.usesmile.io/webhooks

---

## Future Enhancements

1. **Admin Dashboard**
   - View pending KYC approvals
   - Manual approval for edge cases
   - KYC approval statistics

2. **Retry Logic**
   - Allow users to retry failed KYC
   - Store rejection reasons

3. **KYC Expiry**
   - Re-verify users after X years
   - Track KYC approval dates

4. **Smile Sync**
   - Periodically sync verification status
   - Fallback if webhook missed

---

## Support

For questions about Smile integration:
- **Smile Docs:** https://docs.usesmile.io
- **Support:** hello@usesmile.io

For questions about backend implementation:
- See `routes/kyc.js` code comments
- See this file for architecture overview

