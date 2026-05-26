const express = require('express');
const router = express.Router();
const { connectPolymesh } = require('../config/polymesh');

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

module.exports = router;