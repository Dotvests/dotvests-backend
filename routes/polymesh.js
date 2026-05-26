const express = require('express');
const router = express.Router();
const { BigNumber } = require('@polymeshassociation/polymesh-sdk');
const { connectPolymesh } = require('../config/polymesh');
const { protect } = require('../middleware/auth');
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
    const portfolios = await identity.portfolios.getPortfolios();

    const allBalances = [];

    for (const portfolio of portfolios) {
      const balances = await portfolio.getAssetBalances();
      for (const b of balances) {
        const details = await b.asset.details();
        allBalances.push({
          assetId: b.asset.id,
          name: details.name,
          ticker: details.ticker,
          total: b.total.toString(),
          free: b.free.toString(),
          locked: b.locked.toString(),
        });
      }
    }

    return res.json({ success: true, portfolio: allBalances });

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

    db.prepare('UPDATE users SET polymesh_did = ? WHERE id = ?').run(did, req.user.id);

    return res.json({ success: true, did });
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
    const issuerPortfolios = await issuerIdentity.portfolios.getPortfolios();
    const issuerPortfolio = issuerPortfolios[0];

    const investorIdentity = await polymesh.identities.getIdentity({ did: user_did });
    const investorPortfolios = await investorIdentity.portfolios.getPortfolios();
    const investorPortfolio = investorPortfolios[0];

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

module.exports = router;