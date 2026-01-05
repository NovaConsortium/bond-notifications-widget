const { Connection, PublicKey } = require('@solana/web3.js');

class SolanaService {
  constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL;
    if (!rpcUrl) {
      throw new Error('SOLANA_RPC_URL environment variable is required');
    }
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  async getBalance(address) {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      return balance / 1_000_000_000;
    } catch (error) {
      throw new Error(`Failed to get balance for address ${address}: ${error.message}`);
    }
  }

  isValidAddress(address) {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  async isConnected() {
    try {
      const version = await this.connection.getVersion();
      return !!version;
    } catch {
      return false;
    }
  }

  extractValidatorFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const validatorIndex = pathParts.indexOf('validators');
      
      if (validatorIndex !== -1 && pathParts[validatorIndex + 1]) {
        const validatorAddress = pathParts[validatorIndex + 1];
        if (this.isValidAddress(validatorAddress)) {
          return validatorAddress;
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  getBondAddressFromValidator(validatorAddress) {
    try {
      const VALIDATOR_BOND_SEED = 'validator_bond';
      const BOND_PROGRAM_ID = new PublicKey('BondQ7KqZreTcW2UbeTNDcLCJQ3aXAtLn2Fm6ftaJDU');
      const PERFORMANCE_BOND_ID = new PublicKey('B1H5wi6YpLm4DAWsbofpHCJy4LRHV7CLT3ocmXnWAQCJ');
      
      const vote = new PublicKey(validatorAddress);
      
      const [addr] = PublicKey.findProgramAddressSync(
        [
          Buffer.from(VALIDATOR_BOND_SEED),
          PERFORMANCE_BOND_ID.toBuffer(),
          vote.toBuffer()
        ],
        BOND_PROGRAM_ID
      );
      
      return addr.toString();
    } catch (error) {
      throw new Error(`Failed to derive bond address from validator: ${error.message}`);
    }
  }
}

module.exports = new SolanaService();

