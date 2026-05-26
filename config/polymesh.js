const { Polymesh } = require('@polymeshassociation/polymesh-sdk');
const { Keyring } = require('@polkadot/keyring');
const { cryptoWaitReady, blake2AsU8a } = require('@polkadot/util-crypto');
const { TypeRegistry } = require('@polkadot/types');
const fs = require('fs');
const path = require('path');

let polymeshInstance = null;

const connectPolymesh = async () => {
  if (polymeshInstance) return polymeshInstance;

  try {
    await cryptoWaitReady();

    const keystorePath = path.resolve(process.env.POLYMESH_KEYSTORE_PATH);
    const keystoreJson = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));
    const password = process.env.POLYMESH_KEYSTORE_PASSWORD;

    const keyring = new Keyring({ type: 'sr25519' });
    const pair = keyring.addFromJson(keystoreJson);
    pair.decodePkcs8(password);

    console.log('Account loaded:', pair.address);

    // TypeRegistry from the same @polkadot/types v11 the SDK uses — ensures
    // ExtrinsicPayload encodes identically to what the chain expects.
    // CheckTxVersion (transactionVersion: u32) is absent from the default
    // registry in this polkadot.js version and must be registered manually.
    const registry = new TypeRegistry();
    registry.setSignedExtensions(
      ['CheckSpecVersion', 'CheckTxVersion', 'CheckGenesis', 'CheckMortality',
       'CheckNonce', 'CheckWeight', 'ChargeTransactionPayment', 'StoreCallMetadata'],
      {
        CheckTxVersion:    { extrinsic: {}, payload: { transactionVersion: 'u32' } },
        StoreCallMetadata: { extrinsic: {}, payload: {} },
      }
    );

    const signingManager = {
      setSs58Format: (format) => { keyring.setSS58Format(format); },
      getAccounts: async () => [pair.address],

      signPayload: async (payload) => {
        const raw = registry.createType('ExtrinsicPayload', payload, { version: payload.version });
        const u8a = raw.toU8a(true);
        const toSign = u8a.length > 256 ? blake2AsU8a(u8a) : u8a;
        const sig = pair.sign(toSign, { withType: true });
        return { id: 1, signature: '0x' + Buffer.from(sig).toString('hex') };
      },

      signRaw: async (raw) => {
        const data = Buffer.from(raw.data.replace(/^0x/, ''), 'hex');
        const sig = pair.sign(data, { withType: true });
        return { id: 1, signature: '0x' + Buffer.from(sig).toString('hex') };
      },

      // connect() calls getExternalSigner() to register a Polkadot.js API signer.
      // Returning `this` reuses the methods already defined above.
      getExternalSigner() { return this; },
    };

    polymeshInstance = await Polymesh.connect({
      nodeUrl: process.env.POLYMESH_NODE_URL,
      signingManager,
    });

    const networkInfo = await polymeshInstance.network.getNetworkProperties();
    console.log(`Polymesh connected: ${networkInfo.name}`);

    return polymeshInstance;

  } catch (error) {
    console.error('Polymesh connection failed:', error.message);
    throw error;
  }
};

module.exports = { connectPolymesh };
