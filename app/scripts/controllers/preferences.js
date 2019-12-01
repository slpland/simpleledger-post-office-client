const ObservableStore = require('obs-store')
const { isValidAddress } = require('ethereumjs-util')
const extend = require('xtend')

// TODO: normalize bch and token addresses
function normalizeAddress (address) {
  return address
}

class PreferencesController {
  /**
   *
   * @typedef {Object} PreferencesController
   * @param {object} opts Overrides the defaults for the initial state of this.store
   * @property {object} store The stored object containing a users preferences, stored in local storage
   * @property {array} store.frequentRpcList A list of custom rpcs to provide the user
   * @property {string} store.currentAccountTab Indicates the selected tab in the ui
   * @property {array} store.tokens The tokens the user wants display in their token lists
   * @property {object} store.accountTokens The tokens stored per account and then per network type
   * @property {object} store.assetImages Contains assets objects related to assets added
   * @property {boolean} store.useBlockie The users preference for blockie identicons within the UI
   * @property {object} store.featureFlags A key-boolean map, where keys refer to features and booleans to whether the
   * user wishes to see that feature
   * @property {string} store.currentLocale The preferred language locale key
   * @property {string} store.selectedAddress A hex string that matches the currently selected address in the app
   *
   */
  constructor (opts = {}) {
    const initState = extend(
      {
        frequentRpcList: [],
        currentAccountTab: 'history',
        accountTokens: {},
        assetImages: {},
        tokens: [],
        suggestedTokens: {},
        useBlockie: true,
        featureFlags: {},
        currentLocale: opts.initLangCode,
        identities: {},
        lostIdentities: {},
        seedWords: null,
        forgottenPassword: false,
      },
      opts.initState,
      {
        seedWords: null,
      }
    )

    this.diagnostics = opts.diagnostics
    this.network = opts.network
    this.store = new ObservableStore(initState)
    this.showWatchAssetUi = opts.showWatchAssetUi
    this._subscribeProviderType()
  }
  // PUBLIC METHODS

  /**
   * Sets the {@code forgottenPassword} state property
   * @param {boolean} forgottenPassword whether or not the user has forgotten their password
   */
  setPasswordForgotten (forgottenPassword) {
    this.store.updateState({ forgottenPassword })
  }

  /**
   * Sets the {@code seedWords} seed words
   * @param {string|null} seedWords the seed words
   */
  setSeedWords (seedWords) {
    this.store.updateState({ seedWords })
  }

  /**
   * Setter for the `useBlockie` property
   *
   * @param {boolean} val Whether or not the user prefers blockie indicators
   *
   */
  setUseBlockie (val) {
    this.store.updateState({ useBlockie: val })
  }

  getSuggestedTokens () {
    return this.store.getState().suggestedTokens
  }

  getAssetImages () {
    return this.store.getState().assetImages
  }

  addSuggestedERC20Asset (tokenOpts) {
    this._validateERC20AssetParams(tokenOpts)
    const suggested = this.getSuggestedTokens()
    const { rawAddress, symbol, decimals, image } = tokenOpts
    const address = normalizeAddress(rawAddress)
    const newEntry = { address, symbol, decimals, image }
    suggested[address] = newEntry
    this.store.updateState({ suggestedTokens: suggested })
  }

  /**
   * RPC engine middleware for requesting new asset added
   *
   * @param req
   * @param res
   * @param {Function} - next
   * @param {Function} - end
   */
  async requestWatchAsset (req, res, next, end) {
    if (req.method === 'metamask_watchAsset') {
      const { type, options } = req.params
      switch (type) {
        case 'ERC20':
          const result = await this._handleWatchAssetERC20(options)
          if (result instanceof Error) {
            end(result)
          } else {
            res.result = result
            end()
          }
          break
        default:
          end(new Error(`Asset of type ${type} not supported`))
      }
    } else {
      next()
    }
  }

  /**
   * Getter for the `useBlockie` property
   *
   * @returns {boolean} this.store.useBlockie
   *
   */
  getUseBlockie () {
    return this.store.getState().useBlockie
  }

  /**
   * Setter for the `currentLocale` property
   *
   * @param {string} key he preferred language locale key
   *
   */
  setCurrentLocale (key) {
    this.store.updateState({ currentLocale: key })
  }

  /**
   * Updates identities to only include specified addresses. Removes identities
   * not included in addresses array
   *
   * @param {string[]} addresses An array of hex addresses
   *
   */
  setAddresses (addresses, slpAddresses) {
    const oldIdentities = this.store.getState().identities
    const oldAccountTokens = this.store.getState().accountTokens

    const identities = addresses.reduce((ids, address, index) => {
      const oldId = oldIdentities[address] || {}
      const slpAddress = slpAddresses[index]
      ids[address] = { name: `Account ${index + 1}`, address, slpAddress, ...oldId }
      return ids
    }, {})
    const accountTokens = addresses.reduce((tokens, address) => {
      const oldTokens = oldAccountTokens[address] || {}
      tokens[address] = oldTokens
      return tokens
    }, {})
    this.store.updateState({ identities, accountTokens })

    // If the selected account is no longer valid,
    // select an arbitrary other account:
    let selected = this.getSelectedAddress()
    if (addresses.length > 0) {
      selected = addresses[0]
      this.setSelectedAddress(selected)
    }
  }

  /**
   * Removes an address from state
   *
   * @param {string} address A hex address
   * @returns {string} the address that was removed
   */
  removeAddress (address) {
    const identities = this.store.getState().identities
    const accountTokens = this.store.getState().accountTokens
    if (!identities[address]) {
      throw new Error(`${address} can't be deleted cause it was not found`)
    }
    delete identities[address]
    delete accountTokens[address]
    this.store.updateState({ identities, accountTokens })

    // If the selected account is no longer valid,
    // select an arbitrary other account:
    if (address === this.getSelectedAddress()) {
      const selected = Object.keys(identities)[0]
      this.setSelectedAddress(selected)
    }
    return address
  }

  removeTokensByAccount (address) {
    const accountTokens = this.store.getState().accountTokens
    delete accountTokens[address]
    this.store.updateState({ accountTokens })

    return address
  }

  /**
   * Adds addresses to the identities object without removing identities
   *
   * @param {string[]} addresses An array of hex addresses
   *
   */
  addAddresses (addresses, slpAddresses) {
    const identities = this.store.getState().identities
    const accountTokens = this.store.getState().accountTokens
    addresses.forEach((address, index) => {
      // skip if already exists
      if (identities[address]) return
      // add missing identity
      const identityCount = Object.keys(identities).length

      accountTokens[address] = {}
      const slpAddress = slpAddresses[index]
      identities[address] = { name: `Account ${identityCount + 1}`, address, slpAddress }
    })
    this.store.updateState({ identities, accountTokens })
  }

  /*
   * Synchronizes identity entries with known accounts.
   * Removes any unknown identities, and returns the resulting selected address.
   *
   * @param {Array<string>} addresses known to the vault.
   * @returns {Promise<string>} selectedAddress the selected address.
   */
  syncAddresses (addresses, slpAddresses) {
    const { identities, lostIdentities } = this.store.getState()

    const newlyLost = {}
    Object.keys(identities).forEach(identity => {
      if (!addresses.includes(identity)) {
        newlyLost[identity] = identities[identity]
        delete identities[identity]
      }
    })

    // Identities are no longer present.
    if (Object.keys(newlyLost).length > 0) {
      // Notify our servers:
      // if (this.diagnostics) this.diagnostics.reportOrphans(newlyLost)

      // store lost accounts
      for (const key in newlyLost) {
        lostIdentities[key] = newlyLost[key]
      }
    }

    this.store.updateState({ identities, lostIdentities })
    this.addAddresses(addresses, slpAddresses)

    // If the selected account is no longer valid,
    // select an arbitrary other account:
    let selected = this.getSelectedAddress()
    if (!addresses.includes(selected)) {
      selected = addresses[0]
      this.setSelectedAddress(selected)
    }

    return selected
  }

  removeSuggestedTokens () {
    return new Promise((resolve, reject) => {
      this.store.updateState({ suggestedTokens: {} })
      resolve({})
    })
  }

  /**
   * Setter for the `selectedAddress` property
   *
   * @param {string} _address A new hex address for an account
   * @returns {Promise<void>} Promise resolves with tokens
   *
   */
  setSelectedAddress (_address) {
    const address = normalizeAddress(_address)
    this._updateTokens(address)
    this.store.updateState({ selectedAddress: address })

    // Update Selected SLP address
    const slpAddress = this.getSlpAddressForAccount(address)
    this.store.updateState({ selectedSlpAddress: slpAddress })

    const tokens = this.store.getState().tokens
    return Promise.resolve(tokens)
  }

  /**
   * Getter for the `selectedAddress` property
   *
   * @returns {string} The hex address for the currently selected account
   *
   */
  getSelectedAddress () {
    return this.store.getState().selectedAddress
  }

  getSelectedSlpAddress () {
    const selectedIdentity = this.store.getState().identities[this.store.getState().selectedAddress]
    return selectedIdentity.slpAddress
  }

  getSlpAddressForAccount (address) {
    const selectedIdentity = this.store.getState().identities[address]
    return selectedIdentity.slpAddress
  }

  /**
   * Contains data about tokens users add to their account.
   * @typedef {Object} AddedToken
   * @property {string} address - The hex address for the token contract. Will be all lower cased and hex-prefixed.
   * @property {string} symbol - The symbol of the token, usually 3 or 4 capitalized letters
   *  {@link https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20.md#symbol}
   * @property {boolean} decimals - The number of decimals the token uses.
   *  {@link https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20.md#decimals}
   */

  /**
   * Adds a new token to the token array, or updates the token if passed an address that already exists.
   * Modifies the existing tokens array from the store. All objects in the tokens array array AddedToken objects.
   * @see AddedToken {@link AddedToken}
   *
   * @param {string} rawAddress Hex address of the token contract. May or may not be a checksum address.
   * @param {string} symbol The symbol of the token
   * @param {number} decimals  The number of decimals the token uses.
   * @returns {Promise<array>} Promises the new array of AddedToken objects.
   *
   */
  async addToken (tokenData, image) {
    const tokens = this.store.getState().tokens
    const assetImages = this.getAssetImages()
    const previousEntry = tokens.find((token, index) => {
      return token.address === tokenData.address
    })
    const previousIndex = tokens.indexOf(previousEntry)

    if (previousEntry) {
      tokens[previousIndex] = tokenData
    } else {
      tokens.push(tokenData)
    }
    assetImages[tokenData.address] = image
    this._updateAccountTokens(tokens, assetImages)
    return Promise.resolve(tokens)
  }

  async addTokenByAccount (address, providerType, tokenData, image) {
    const {
      accountTokens,
    } = this._getTokenRelatedStates(address)
    const tokens = accountTokens[address][providerType]
    
    const assetImages = this.getAssetImages()

    tokens.push(tokenData)
    assetImages[tokenData.address] = image
    this._updateAccountTokensByAccount(address, providerType, tokens, assetImages)
    return Promise.resolve(tokens)
  }

  /**
   * Removes a specified token from the tokens array.
   *
   * @param {string} rawAddress Hex address of the token contract to remove.
   * @returns {Promise<array>} The new array of AddedToken objects
   *
   */
  removeToken (rawAddress) {
    const tokens = this.store.getState().tokens
    const assetImages = this.getAssetImages()
    const updatedTokens = tokens.filter(token => token.address !== rawAddress)
    delete assetImages[rawAddress]
    this._updateAccountTokens(updatedTokens, assetImages)
    return Promise.resolve(updatedTokens)
  }

  /**
   * A getter for the `tokens` property
   *
   * @returns {array} The current array of AddedToken objects
   *
   */
  getTokens () {
    return this.store.getState().tokens
  }

  /**
   * Sets a custom label for an account
   * @param {string} account the account to set a label for
   * @param {string} label the custom label for the account
   * @return {Promise<string>}
   */
  setAccountLabel (account, label) {
    if (!account) {
      throw new Error(
        'setAccountLabel requires a valid address, got ' + String(account)
      )
    }
    const address = normalizeAddress(account)
    const { identities } = this.store.getState()
    identities[address] = identities[address] || {}
    identities[address].name = label
    this.store.updateState({ identities })
    return Promise.resolve(label)
  }

  /**
   * Gets an updated rpc list from this.addToFrequentRpcList() and sets the `frequentRpcList` to this update list.
   *
   * @param {string} _url The the new rpc url to add to the updated list
   * @returns {Promise<void>} Promise resolves with undefined
   *
   */
  updateFrequentRpcList (_url) {
    return this.addToFrequentRpcList(_url).then(rpcList => {
      this.store.updateState({ frequentRpcList: rpcList })
      return Promise.resolve()
    })
  }

  /**
   * Setter for the `currentAccountTab` property
   *
   * @param {string} currentAccountTab Specifies the new tab to be marked as current
   * @returns {Promise<void>} Promise resolves with undefined
   *
   */
  setCurrentAccountTab (currentAccountTab) {
    return new Promise((resolve, reject) => {
      this.store.updateState({ currentAccountTab })
      resolve()
    })
  }

  /**
   * Returns an updated rpcList based on the passed url and the current list.
   * The returned list will have a max length of 3. If the _url currently exists it the list, it will be moved to the
   * end of the list. The current list is modified and returned as a promise.
   *
   * @param {string} _url The rpc url to add to the frequentRpcList.
   * @returns {Promise<array>} The updated frequentRpcList.
   *
   */
  addToFrequentRpcList (_url) {
    const rpcList = this.getFrequentRpcList()
    const index = rpcList.findIndex(element => {
      return element === _url
    })
    if (index !== -1) {
      rpcList.splice(index, 1)
    }
    if (_url !== 'http://localhost:8545') {
      rpcList.push(_url)
    }
    if (rpcList.length > 3) {
      rpcList.shift()
    }
    return Promise.resolve(rpcList)
  }

  /**
   * Getter for the `frequentRpcList` property.
   *
   * @returns {array<string>} An array of one or two rpc urls.
   *
   */
  getFrequentRpcList () {
    return this.store.getState().frequentRpcList
  }

  /**
   * Updates the `featureFlags` property, which is an object. One property within that object will be set to a boolean.
   *
   * @param {string} feature A key that corresponds to a UI feature.
   * @param {boolean} activated Indicates whether or not the UI feature should be displayed
   * @returns {Promise<object>} Promises a new object; the updated featureFlags object.
   *
   */
  setFeatureFlag (feature, activated) {
    const currentFeatureFlags = this.store.getState().featureFlags
    const updatedFeatureFlags = {
      ...currentFeatureFlags,
      [feature]: activated,
    }

    this.store.updateState({ featureFlags: updatedFeatureFlags })

    return Promise.resolve(updatedFeatureFlags)
  }

  /**
   * A getter for the `featureFlags` property
   *
   * @returns {object} A key-boolean map, where keys refer to features and booleans to whether the
   * user wishes to see that feature
   *
   */
  getFeatureFlags () {
    return this.store.getState().featureFlags
  }
  //
  // PRIVATE METHODS
  //

  /**
   * Subscription to network provider type.
   *
   *
   */
  _subscribeProviderType () {
    this.network.providerStore.subscribe(() => {
      const { tokens } = this._getTokenRelatedStates()
      this.store.updateState({ tokens })
    })
  }

  /**
   * Updates `accountTokens` and `tokens` of current account and network according to it.
   *
   * @param {array} tokens Array of tokens to be updated.
   *
   */
  _updateAccountTokens (tokens, assetImages) {
    const {
      accountTokens,
      providerType,
      selectedAddress,
    } = this._getTokenRelatedStates()
    accountTokens[selectedAddress][providerType] = tokens
    this.store.updateState({ accountTokens, tokens, assetImages })
  }

  _updateAccountTokensByAccount (address, providerType, tokens, assetImages) {
    const {
      accountTokens,
    } = this._getTokenRelatedStates(address)
    accountTokens[address][providerType] = tokens
    this.store.updateState({ accountTokens, assetImages })
  }

  /**
   * Updates `tokens` of current account and network.
   *
   * @param {string} selectedAddress Account address to be updated with.
   *
   */
  _updateTokens (selectedAddress) {
    const { tokens } = this._getTokenRelatedStates(selectedAddress)
    this.store.updateState({ tokens })
  }

  /**
   * A getter for `tokens` and `accountTokens` related states.
   *
   * @param {string} selectedAddress A new hex address for an account
   * @returns {Object.<array, object, string, string>} States to interact with tokens in `accountTokens`
   *
   */
  _getTokenRelatedStates (selectedAddress) {
    const accountTokens = this.store.getState().accountTokens
    if (!selectedAddress) {
      selectedAddress = this.store.getState().selectedAddress
    }
    const providerType = this.network.providerStore.getState().type
    if (!(selectedAddress in accountTokens)) accountTokens[selectedAddress] = {}
    if (!(providerType in accountTokens[selectedAddress])) {
      accountTokens[selectedAddress][providerType] = []
    }
    const tokens = accountTokens[selectedAddress][providerType]
    return { tokens, accountTokens, providerType, selectedAddress }
  }

  /**
   * Handle the suggestion of an ERC20 asset through `watchAsset`
   * *
   * @param {Promise} promise Promise according to addition of ERC20 token
   *
   */
  async _handleWatchAssetERC20 (options) {
    const { address, symbol, decimals, image } = options
    const rawAddress = address
    try {
      this._validateERC20AssetParams({ rawAddress, symbol, decimals })
    } catch (err) {
      return err
    }
    const tokenOpts = { rawAddress, decimals, symbol, image }
    this.addSuggestedERC20Asset(tokenOpts)
    return this.showWatchAssetUi().then(() => {
      const tokenAddresses = this.getTokens().filter(
        token => token.address === normalizeAddress(rawAddress)
      )
      return tokenAddresses.length > 0
    })
  }

  /**
   * Validates that the passed options for suggested token have all required properties.
   *
   * @param {Object} opts The options object to validate
   * @throws {string} Throw a custom error indicating that address, symbol and/or decimals
   * doesn't fulfill requirements
   *
   */
  _validateERC20AssetParams (opts) {
    const { rawAddress, symbol, decimals } = opts
    if (!rawAddress || !symbol || !decimals) {
      throw new Error(
        `Cannot suggest token without address, symbol, and decimals`
      )
    }
    if (!(symbol.length < 6)) {
      throw new Error(`Invalid symbol ${symbol} more than five characters`)
    }
    const numDecimals = parseInt(decimals, 10)
    if (isNaN(numDecimals) || numDecimals > 36 || numDecimals < 0) {
      throw new Error(
        `Invalid decimals ${decimals} must be at least 0, and not over 36`
      )
    }
    if (!isValidAddress(rawAddress)) {
      throw new Error(`Invalid address ${rawAddress}`)
    }
  }
}

module.exports = PreferencesController
