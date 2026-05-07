# Smile Identity SDK - Frontend Integration Guide

This guide explains how to integrate Smile Identity SDK on the frontend for KYC verification. The backend is now simplified to receive the verified `smile_job_id` from the frontend.

---

## Architecture

```
Frontend                           Backend                    Smile Identity
  │                                 │                           │
  ├─ User starts KYC                │                           │
  │                                 │                           │
  ├─ Show Smile SDK/WebView         │                           │
  │                                 │                           │
  ├─ User completes liveness check  │                           │
  ├─ User scans document            │ ◄──────────────────────── Smile processes
  ├─ Document matches selfie        │       verification        │
  │                                 │                           │
  ├─ Smile returns job_id ──────────────────────────────────────►
  │                                 │                           │
  ├─ Send job_id to backend         │                           │
  │  POST /api/kyc/submit           │                           │
  │  { smile_job_id: "job_xxx" }    │                           │
  │                                 │                           │
  │                         ◄────── Smile webhook ─────────────┤
  │                            (job verification result)         │
  │                                 │                           │
  ├─ Poll /api/kyc/status ◄────────────────────────────────────┤
  │                          (verified or rejected)              │
  │                                 │                           │
  └─ Show wallet creation button    │                           │
```

---

## Backend API (Simplified)

### 1. POST /api/kyc/submit

**What changed:** Backend now only receives `smile_job_id`, not documents.

**Request:**
```json
POST /api/kyc/submit
{
  "smile_job_id": "job_605e3a2b4de6c30022d5c11b"
}
```

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Response (Success):**
```json
{
  "success": true,
  "message": "KYC submitted successfully",
  "status": "pending",
  "smile_job_id": "job_605e3a2b4de6c30022d5c11b",
  "kyc_submitted_at": "2026-05-07T10:00:00Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "KYC already verified for this account"
}
```

---

### 2. GET /api/kyc/status

Check current verification status (backend returns what Smile webhook told it).

**Request:**
```
GET /api/kyc/status
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "kyc_status": "pending",
    "smile_job_id": "job_605e3a2b4de6c30022d5c11b",
    "submitted_at": "2026-05-07T10:00:00Z"
  }
}
```

**Status Values:**
- `unverified` — Not yet submitted to Smile
- `pending` — Submitted, waiting for Smile to complete verification
- `verified` — Approved, can create wallet
- `rejected` — Declined, cannot trade

---

### 3. Smile Webhook (Backend Receives)

When Smile completes verification, it sends a webhook to:
```
POST /api/kyc/webhook
```

**Payload (from Smile):**
```json
{
  "job_id": "job_605e3a2b4de6c30022d5c11b",
  "user_id": 1,
  "result": {
    "status": "Approved"
  }
}
```

**Backend:**
- Validates Smile signature (HMAC-SHA256)
- Updates user's `kyc_status` to `verified`
- Sends notification to user
- User sees wallet creation button

---

## Frontend Implementation

### Step 1: Install Smile SDK

**For Web (React/Vue/Angular):**
```bash
npm install @smileidentity/web-core
```

**For Mobile (React Native):**
```bash
npm install @smileidentity/react-native
```

**For iOS (Native):**
```bash
pod install SmileID
```

**For Android (Native):**
```gradle
implementation 'com.smileidentity:android-sdk:X.Y.Z'
```

---

### Step 2: Initialize Smile SDK

**React Example:**

```jsx
import { SmileID } from '@smileidentity/web-core';

const KYCScreen = () => {
  const handleSmileComplete = async (result) => {
    // result contains the Smile job details
    console.log('Smile verification complete:', result);
    
    // Extract job_id
    const jobId = result.job_id;
    
    // Send to backend
    await submitKYCToBackend(jobId);
  };

  const handleSmileError = (error) => {
    console.error('Smile error:', error);
    setError('KYC verification failed. Please try again.');
  };

  return (
    <SmileID
      onSuccess={handleSmileComplete}
      onError={handleSmileError}
      partnerID={process.env.REACT_APP_SMILE_PARTNER_ID}
      userId={currentUser.id.toString()}
      country="NG"
      idType="BVN" // or "NIN"
      requireLiveness={true}
      requireDocumentCapture={true}
    />
  );
};
```

---

### Step 3: Send Job ID to Backend

After Smile completes verification, send the `job_id` to backend:

```javascript
const submitKYCToBackend = async (jobId) => {
  try {
    const response = await fetch('/api/kyc/submit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        smile_job_id: jobId
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log('KYC submitted:', data);
      setKycStatus('pending');
      // Start polling for verification result
      pollVerificationStatus();
    } else {
      setError(data.message);
    }
  } catch (error) {
    console.error('Failed to submit KYC:', error);
    setError('Failed to submit KYC. Please try again.');
  }
};
```

---

### Step 4: Poll for Verification Result

After submission, poll the backend for verification status (Smile webhook will update it):

```javascript
const pollVerificationStatus = async () => {
  const maxAttempts = 30; // Poll for 5 minutes (10-second intervals)
  let attempts = 0;

  const interval = setInterval(async () => {
    try {
      const response = await fetch('/api/kyc/status', {
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });

      const data = await response.json();

      if (data.data.kyc_status === 'verified') {
        clearInterval(interval);
        setKycStatus('verified');
        showNotification('KYC Verification Complete! You can now create a wallet.');
      } else if (data.data.kyc_status === 'rejected') {
        clearInterval(interval);
        setKycStatus('rejected');
        showError('KYC Verification Failed. Please contact support.');
      }

      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    } catch (error) {
      console.error('Error checking KYC status:', error);
    }
  }, 10000); // Poll every 10 seconds
};
```

---

### Step 5: Show Wallet Creation Button

Once KYC is verified, show the wallet creation button:

```javascript
const KYCStatus = () => {
  const [kycStatus, setKycStatus] = useState(null);

  useEffect(() => {
    checkKYCStatus();
  }, []);

  const checkKYCStatus = async () => {
    const response = await fetch('/api/kyc/status', {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    const data = await response.json();
    setKycStatus(data.data.kyc_status);
  };

  return (
    <div>
      {kycStatus === 'unverified' && (
        <button onClick={() => openSmileSDK()}>
          Start KYC Verification
        </button>
      )}

      {kycStatus === 'pending' && (
        <div>
          ⏳ KYC verification in progress...
          <p>We're verifying your documents. This usually takes 1-2 minutes.</p>
        </div>
      )}

      {kycStatus === 'verified' && (
        <button onClick={() => createWallet()}>
          Create Wallet (Next Step)
        </button>
      )}

      {kycStatus === 'rejected' && (
        <div>
          ❌ KYC Verification Failed
          <p>Your verification was not approved. Please contact support.</p>
          <button onClick={() => openSmileSDK()}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};
```

---

## Complete React Implementation Example

```jsx
import React, { useState, useEffect } from 'react';
import { SmileID } from '@smileidentity/web-core';

const KYCFlow = ({ jwtToken, userId }) => {
  const [step, setStep] = useState('check'); // check, smile, waiting, complete, error
  const [kycStatus, setKycStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Step 1: Check current KYC status
  useEffect(() => {
    checkKYCStatus();
  }, []);

  const checkKYCStatus = async () => {
    try {
      const response = await fetch('/api/kyc/status', {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      const data = await response.json();
      const status = data.data.kyc_status;
      
      setKycStatus(status);
      
      if (status === 'unverified') {
        setStep('smile');
      } else if (status === 'pending') {
        setStep('waiting');
        pollForVerification();
      } else if (status === 'verified') {
        setStep('complete');
      } else if (status === 'rejected') {
        setStep('error');
      }
    } catch (err) {
      console.error('Error checking KYC:', err);
      setError('Failed to check KYC status');
      setStep('error');
    }
  };

  // Step 2: Handle Smile SDK completion
  const handleSmileSuccess = async (result) => {
    const jobId = result.job_id;
    setLoading(true);

    try {
      const response = await fetch('/api/kyc/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ smile_job_id: jobId })
      });

      const data = await response.json();

      if (data.success) {
        setStep('waiting');
        pollForVerification();
      } else {
        setError(data.message);
        setStep('error');
      }
    } catch (err) {
      console.error('Failed to submit KYC:', err);
      setError('Failed to submit KYC. Please try again.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSmileError = (error) => {
    console.error('Smile error:', error);
    setError('KYC verification failed. Please try again.');
    setStep('error');
  };

  // Step 3: Poll for verification result
  const pollForVerification = () => {
    let attempts = 0;
    const maxAttempts = 30;

    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/kyc/status', {
          headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const data = await response.json();
        const status = data.data.kyc_status;

        if (status === 'verified') {
          clearInterval(interval);
          setStep('complete');
        } else if (status === 'rejected') {
          clearInterval(interval);
          setStep('error');
          setError('Your KYC verification was declined.');
        }

        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Error polling:', err);
      }
    }, 10000);
  };

  return (
    <div className="kyc-container">
      {step === 'smile' && (
        <SmileID
          onSuccess={handleSmileSuccess}
          onError={handleSmileError}
          partnerID={process.env.REACT_APP_SMILE_PARTNER_ID}
          userId={userId.toString()}
          country="NG"
          idType="BVN"
          requireLiveness={true}
          requireDocumentCapture={true}
        />
      )}

      {step === 'waiting' && (
        <div className="waiting">
          <h2>⏳ Verifying Your Identity</h2>
          <p>We're processing your documents. This usually takes 1-2 minutes.</p>
          <div className="spinner"></div>
        </div>
      )}

      {step === 'complete' && (
        <div className="success">
          <h2>✅ KYC Verification Complete!</h2>
          <p>Your identity has been verified. You can now create a wallet.</p>
          <button onClick={() => window.location.href = '/wallet'}>
            Create Wallet
          </button>
        </div>
      )}

      {step === 'error' && (
        <div className="error">
          <h2>❌ Verification Failed</h2>
          <p>{error || 'Something went wrong'}</p>
          <button onClick={checkKYCStatus}>Check Status</button>
          <button onClick={() => setStep('smile')}>Try Again</button>
        </div>
      )}
    </div>
  );
};

export default KYCFlow;
```

---

## Environment Variables

Add to your `.env.example`:

```env
REACT_APP_SMILE_PARTNER_ID=your_smile_partner_id
```

And in actual `.env`:

```env
REACT_APP_SMILE_PARTNER_ID=XXX123
```

---

## Smile SDK Documentation Links

- **Web SDK:** https://docs.usesmile.io/web
- **React Native:** https://docs.usesmile.io/react-native
- **iOS:** https://docs.usesmile.io/ios
- **Android:** https://docs.usesmile.io/android

---

## What Smile SDK Does

1. **Liveness Detection**
   - Captures user's face video
   - Verifies user is a real person (not a photo/deepfake)
   - Real-time quality feedback

2. **Document Capture**
   - User scans their ID document (BVN card, National ID, Passport)
   - Smile extracts text via OCR
   - Verifies document authenticity

3. **Biometric Matching**
   - Compares selfie to document photo
   - Ensures selfie matches the ID document
   - Confidence score returned

4. **Returns Job ID**
   - When complete, SDK returns `job_id`
   - Job contains all verification results
   - Backend stores `job_id` for reference

---

## Backend Webhook Flow

When Smile finishes processing:

1. **Smile sends webhook:**
   ```
   POST /api/kyc/webhook
   {
     "job_id": "job_605e3a2b4de6c30022d5c11b",
     "user_id": 1,
     "result": {
       "status": "Approved"
     }
   }
   ```

2. **Backend validates signature** (HMAC-SHA256)

3. **Backend updates database:**
   ```sql
   UPDATE users SET kyc_status = 'verified', liveness_passed = 1
   WHERE id = 1 AND smile_job_id = 'job_605e3a2b4de6c30022d5c11b'
   ```

4. **Backend sends notification:**
   - User sees "KYC Verification Complete"
   - Wallet creation button becomes available

5. **Frontend polls /api/kyc/status** (every 10s)
   - Sees status changed to 'verified'
   - Shows success message
   - Enables wallet creation

---

## Testing Without Real Smile Account

For development, mock the webhook:

```bash
# Simulate Smile completing verification
curl -X POST "http://localhost:3000/api/kyc/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Smile-Signature: (skip for testing)" \
  -d '{
    "job_id": "job_test_123",
    "user_id": 1,
    "result": {
      "status": "Approved"
    }
  }'
```

---

## Security Checklist

- ✅ Frontend sends only `smile_job_id` to backend (not documents)
- ✅ Backend validates Smile webhook signature (HMAC)
- ✅ Backend never stores raw images or biometric data
- ✅ Smile handles all sensitive data processing
- ✅ KYC status only updated via verified webhook
- ✅ User JWT required to check status
- ✅ No direct access to Smile API from frontend

