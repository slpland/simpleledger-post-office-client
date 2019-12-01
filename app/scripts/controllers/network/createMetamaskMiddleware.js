const mergeMiddleware = require('json-rpc-engine/src/mergeMiddleware')
const createScaffoldMiddleware = require('json-rpc-engine/src/createScaffoldMiddleware')
const createAsyncMiddleware = require('json-rpc-engine/src/createAsyncMiddleware')
const createWalletSubprovider = require('bch-json-rpc-middleware/wallet')

module.exports = createMetamaskMiddleware

function createMetamaskMiddleware ({
  version,
  getAccounts,
  getSlpAccounts,
  processTransaction,
  processEthSignMessage,
  processTypedMessage,
  processPersonalMessage,
  getPendingNonce,
}) {
  const metamaskMiddleware = mergeMiddleware([
    createScaffoldMiddleware({
      // staticSubprovider
      eth_syncing: false,
      web3_clientVersion: `MetaMask/v${version}`,
    }),
    createWalletSubprovider({
      getAccounts,
      getSlpAccounts,
      processTransaction,
      processEthSignMessage,
      processTypedMessage,
      processPersonalMessage,
    }),
    createPendingNonceMiddleware({ getPendingNonce }),
  ])
  return metamaskMiddleware
}

function createPendingNonceMiddleware ({ getPendingNonce }) {
  return createAsyncMiddleware(async (req, res, next) => {
    return next()

    // if (req.method !== 'eth_getTransactionCount') return next()
    // const address = req.params[0]
    // const blockRef = req.params[1]
    // if (blockRef !== 'pending') return next()
    // req.result = await getPendingNonce(address)
  })
}
