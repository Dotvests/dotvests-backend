const express = require('express');
const router = express.Router();
const { BigNumber } = require('@polymeshassociation/polymesh-sdk');
const { connectPolymesh } = require('../config/polymesh');
const { protect, adminOnly } = require('../middleware/auth');
const db = require('../config/db');

// GET /api/polymesh/assets - fetch all DotVests assets
router.get('/assets', async (req, res) => {
  try {
    const polymesh = await connectPolymesh();
    const identity = await polymesh.getSigningIdentity();
    const result = await identity.assetPermissions.get();
    const assets = Object.values(result);

    const assetList = await Promise.all(
      assets.map(async (item) => {
        const asset = item.asset || item;
        const details = await asset.details();
        return {
          id: asset.id,
          name: details.name,
          ticker: details.ticker,
          totalSupply: details.totalSupply.toString(),
          assetType: details.assetType,
          isDivisible: details.isDivisible,
        };
      })
    );

    return res.json({ success: true, assets: assetList });

  } catch (error) {
    console.error('Asset fetch error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/polymesh/assets/:id - fetch single asset by id or ticker
router.get('/assets/:id', async (req, res) => {
  try {
    const polymesh = await connectPolymesh();
    const identity = await polymesh.getSigningIdentity();
    const result = await identity.assetPermissions.get();
    const assets = Object.values(result);

    const items = await Promise.all(
      assets.map(async (item) => {
        const asset = item.asset || item;
        const details = await asset.details();
        return {
          id: asset.id,
          name: details.name,
          ticker: details.ticker,
          totalSupply: details.totalSupply.toString(),
          assetType: details.assetType,
          isDivisible: details.isDivisible,
          ownerDid: details.owner.did,
        };
      })
    );

    const found = items.find(a => a.id === req.params.id || a.ticker === req.params.id);
    if (!found) return res.status(404).json({ success: false, message: 'Asset not found' });

    return res.json({ success: true, asset: found });

  } catch (error) {
    console.error('Asset detail error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/polymesh/portfolio - fetch issuer portfolio balances
router.get('/portfolio', async (req, res) => {
  try {
    const polymesh = await connectPolymesh();
    const identity = await polymesh.getSigningIdentity();
    const defaultPortfolio = await identity.portfolios.getPortfolio();

    const balances = await defaultPortfolio.getAssetBalances();
    const portfolio = await Promise.all(
      balances.map(async (b) => {
        const details = await b.asset.details();
        return {
          assetId: b.asset.id,
          name: details.name,
          ticker: details.ticker,
          total: b.total.toString(),
          free: b.free.toString(),
          locked: b.locked.toString(),
        };
      })
    );

    return res.json({ success: true, portfolio });

  } catch (error) {
    console.error('Portfolio fetch error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/polymesh/identity/create
// Creates a Polymesh DID for the authenticated investor's wallet address.
// Requires the signing account to have CDD provider privileges on the testnet.
router.post('/identity/create', protect, async (req, res) => {
  try {
    const { wallet_address } = req.body;
    if (!wallet_address) {
      return res.status(400).json({ success: false, message: 'wallet_address is required' });
    }

    const polymesh = await connectPolymesh();

    const tx = await polymesh.identities.registerIdentity({
      targetAccount: wallet_address,
      expiry: null,
    });
    const identity = await tx.run();
    const did = identity.did;

    // Confirm default portfolio exists for the new identity (portfolio "0" is always the default)
    const investorIdentity = await polymesh.identities.getIdentity({ did });
    const defaultPortfolio = await investorIdentity.portfolios.getPortfolio();
    // getPortfolio() with no args returns the DefaultPortfolio; store '0' to indicate it is initialised
    const portfolioId = defaultPortfolio ? '0' : null;

    db.prepare('UPDATE users SET polymesh_did = ?, polymesh_portfolio_id = ? WHERE id = ?')
      .run(did, portfolioId, req.user.id);

    return res.json({ success: true, did, portfolioId });
  } catch (error) {
    console.error('Identity creation error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/polymesh/identity/:did/eligible
// Returns whether a DID has a valid (non-expired) CDD claim.
router.get('/identity/:did/eligible', async (req, res) => {
  try {
    const { did } = req.params;
    const polymesh = await connectPolymesh();

    const result = await polymesh.claims.getCddClaims({
      target: did,
      includeExpired: false,
    });

    const eligible = result.data.length > 0;

    return res.json({ success: true, did, eligible });
  } catch (error) {
    console.error('CDD eligibility check error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/polymesh/settle
// Creates a settlement instruction from the issuer's default portfolio
// to the investor's default portfolio for the given asset ticker and amount.
router.post('/settle', protect, async (req, res) => {
  try {
    const { user_did, ticker, amount } = req.body;

    if (!user_did || !ticker || !amount) {
      return res.status(400).json({ success: false, message: 'user_did, ticker, and amount are required' });
    }

    const venueId = process.env.POLYMESH_VENUE_ID;
    if (!venueId) {
      return res.status(500).json({ success: false, message: 'POLYMESH_VENUE_ID is not configured — run scripts/create-venue.js first' });
    }

    const polymesh = await connectPolymesh();

    const venue = await polymesh.settlements.getVenue({ id: new BigNumber(venueId) });

    const issuerIdentity = await polymesh.getSigningIdentity();
    const issuerPortfolio = await issuerIdentity.portfolios.getPortfolio();

    const investorIdentity = await polymesh.identities.getIdentity({ did: user_did });
    const investorPortfolio = await investorIdentity.portfolios.getPortfolio();

    const tx = await venue.addInstruction({
      legs: [{
        from: issuerPortfolio,
        to: investorPortfolio,
        asset: ticker,
        amount: new BigNumber(amount),
      }],
    });
    const instruction = await tx.run();

    return res.json({
      success: true,
      instructionId: instruction.id.toString(),
      from: issuerIdentity.did,
      to: user_did,
      ticker,
      amount: String(amount),
    });
  } catch (error) {
    console.error('Settlement error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/polymesh/settle/:instructionId/affirm
// Affirms the issuer's leg of a pending settlement instruction, triggering
// token transfer once the investor also affirms their receiving leg.
router.post('/settle/:instructionId/affirm', protect, async (req, res) => {
  try {
    const { instructionId } = req.params;

    const polymesh = await connectPolymesh();
    const instruction = await polymesh.settlements.getInstruction({
      id: new BigNumber(instructionId),
    });

    const tx = await instruction.affirm();
    await tx.run();

    // Update local settlements record to 'affirmed'
    db.prepare(
      "UPDATE settlements SET status = 'affirmed' WHERE instruction_id = ? AND user_id = ?"
    ).run(instructionId, req.user.id);

    return res.json({ success: true, instructionId, status: 'affirmed' });

  } catch (error) {
    console.error('Affirmation error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/polymesh/settle/:instructionId/status
// Polls the chain for the current status of a settlement instruction
// and syncs it to the local settlements table.
router.get('/settle/:instructionId/status', protect, async (req, res) => {
  try {
    const { instructionId } = req.params;

    const polymesh = await connectPolymesh();
    const instruction = await polymesh.settlements.getInstruction({
      id: new BigNumber(instructionId),
    });

    const details = await instruction.details();
    // InstructionStatus enum values: Pending, Failed, Success, Rejected, Unknown
    const chainStatus = details.status.toLowerCase();

    // Map chain status to our local status values
    const statusMap = {
      pending:  'pending',
      success:  'settled',
      failed:   'failed',
      rejected: 'failed',
      unknown:  'pending',
    };
    const localStatus = statusMap[chainStatus] || chainStatus;

    db.prepare(
      'UPDATE settlements SET status = ? WHERE instruction_id = ? AND user_id = ?'
    ).run(localStatus, instructionId, req.user.id);

    return res.json({ success: true, instructionId, status: localStatus, chainStatus });

  } catch (error) {
    console.error('Settlement status error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/polymesh/checkpoint/:ticker
// Admin-only. Creates a Polymesh checkpoint (on-chain snapshot of all token
// holders at the current block) for the given asset ticker.
router.post('/checkpoint/:ticker', protect, adminOnly, async (req, res) => {
  try {
    const upperTicker = req.params.ticker.toUpperCase();

    const polymesh = await connectPolymesh();

    // Locate the asset object via the issuer's permissions
    const issuerIdentity = await polymesh.getSigningIdentity();
    const result = await issuerIdentity.assetPermissions.get();
    const assetItems = Object.values(result);

    let assetObj = null;
    for (const item of assetItems) {
      const a = item.asset || item;
      const d = await a.details();
      if (d.ticker === upperTicker) {
        assetObj = a;
        break;
      }
    }

    if (!assetObj) {
      return res.status(404).json({ success: false, message: `Asset ${upperTicker} not found` });
    }

    const tx = await assetObj.checkpoints.create();
    const checkpoint = await tx.run();

    const checkpointId = checkpoint.id.toString();
    const createdAt = await checkpoint.createdAt();

    return res.status(201).json({
      success: true,
      ticker: upperTicker,
      checkpointId,
      blockNumber: createdAt?.blockNumber?.toString() ?? null,
      blockDate: createdAt?.blockDate ?? null,
    });

  } catch (error) {
    console.error('Checkpoint creation error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;