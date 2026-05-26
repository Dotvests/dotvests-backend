const { Polymesh } = require('@polymeshassociation/polymesh-sdk');
const { Keyring } = require('@polkadot/keyring');
const { cryptoWaitReady, u8aToHex } = require('@polkadot/util-crypto');
const { hexToU8a } = require('@polkadot/util');
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

    const signingManager = {
      setSs58Format: (format) => { keyring.setSS58Format(format); },
      getAccounts: async () => [pair.address],
      getExternalSigner: async () => ({
        signPayload: async (payload) => {
          const data = hexToU8a(payload.data);
          const signature = pair.sign(data);
          return { id: 1, signature: u8aToHex(signature) };
        },
        signRaw: async (raw) => {
          const data = hexToU8a(raw.data);
          const signature = pair.sign(data);
          return { id: 1, signature: u8aToHex(signature) };
        }
      })
    };

    polymeshInstance = await Polymesh.connect({
      nodeUrl: process.env.POLYMESH_NODE_URL,
      signingManager
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