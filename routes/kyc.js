const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { protect } = require('../middleware/auth');

// SUBMIT KYC (Frontend has completed Smile verification, sending job_id)
router.post('/submit', protect, async (req, res) => {
  try {
    const { smile_job_id } = req.body;

    if (!smile_job_id) {
      return res.status(400).json({
        success: false,
        message: 'smile_job_id is required (from Smile SDK verification)'
      });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.kyc_status === 'verified') {
      return res.status(400).json({
        success: false,
        message: 'KYC already verified for this account'
      });
    }

    // Store the Smile job ID (frontend has already completed verification via SDK)
    db.prepare(`
      UPDATE users
      SET
        smile_job_id = ?,
        kyc_status = ?,
        kyc_submitted_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(smile_job_id, 'pending', req.user.id);

    // Create notification
    db.prepare(
      'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)'
    ).run(
      req.user.id,
      'KYC Verification Submitted',
      'Your KYC documents have been submitted. We are verifying your identity and will notify you shortly.'
    );

    return res.status(200).json({
      success: true,
      message: 'KYC submitted successfully',
      status: 'pending',
      smile_job_id,
      kyc_submitted_at: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not submit KYC',
      error: error.message
    });
  }
});

// GET KYC STATUS
router.get('/status', protect, (req, res) => {
  try {
    const user = db.prepare('SELECT id, kyc_status, smile_job_id, kyc_submitted_at FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        kyc_status: user.kyc_status,
        smile_job_id: user.smile_job_id,
        submitted_at: user.kyc_submitted_at
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not fetch KYC status',
      error: error.message
    });
  }
});

// KYC WEBHOOK (Smile callback)
router.post('/webhook', (req, res) => {
  try {
    const crypto = require('crypto');
    const signature = req.headers['x-smile-signature'];
    const rawBody = JSON.stringify(req.body);

    if (!signature) {
      console.warn('Missing Smile signature on webhook');
      return res.status(200).json({ received: true });
    }

    // Verify Smile signature
    const secret = process.env.SMILE_API_KEY;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('Invalid Smile webhook signature');
      return res.status(200).json({ received: true });
    }

    const { job_id, user_id, result } = req.body;

    if (!job_id || !user_id || !result) {
      return res.status(200).json({ received: true });
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ? AND smile_job_id = ?').get(parseInt(user_id), job_id);

    if (!user) {
      console.warn(`User not found for job ${job_id}`);
      return res.status(200).json({ received: true });
    }

    if (result.status === 'Approved') {
      db.prepare(
        'UPDATE users SET kyc_status = ?, liveness_passed = 1 WHERE id = ?'
      ).run('verified', parseInt(user_id));

      db.prepare(
        'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)'
      ).run(
        parseInt(user_id),
        'KYC Verification Complete',
        'Your KYC verification has been approved. You can now create a wallet and start investing.'
      );

      console.log(`KYC verified for user ${user_id} via job ${job_id}`);
    } else if (result.status === 'Declined') {
      db.prepare(
        'UPDATE users SET kyc_status = ? WHERE id = ?'
      ).run('rejected', parseInt(user_id));

      db.prepare(
        'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)'
      ).run(
        parseInt(user_id),
        'KYC Verification Failed',
        'Your KYC verification was not approved. Please contact support for more information.'
      );

      console.log(`KYC rejected for user ${user_id} via job ${job_id}`);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.status(200).json({ received: true });
  }
});

module.exports = router;
