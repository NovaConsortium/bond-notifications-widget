const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const getBondAddressScript = `
  async function getBondAddressFromValidator(validatorAddress) {
    const solanaWeb3 = window.solanaWeb3;
    const { PublicKey } = solanaWeb3;
    const VALIDATOR_BOND_SEED = 'validator_bond';
    const BOND_PROGRAM_ID = new PublicKey('BondQ7KqZreTcW2UbeTNDcLCJQ3aXAtLn2Fm6ftaJDU');
    const PERFORMANCE_BOND_ID = new PublicKey('B1H5wi6YpLm4DAWsbofpHCJy4LRHV7CLT3ocmXnWAQCJ');
    
    const vote = new PublicKey(validatorAddress);
    const encoder = new TextEncoder();
    const seedBytes = encoder.encode(VALIDATOR_BOND_SEED);
    
    const [addr] = PublicKey.findProgramAddressSync(
      [
        seedBytes,
        PERFORMANCE_BOND_ID.toBuffer(),
        vote.toBuffer()
      ],
      BOND_PROGRAM_ID
    );
    
    return addr.toString();
  }
  
  function isValidAddress(address) {
    try {
      const solanaWeb3 = window.solanaWeb3;
      new solanaWeb3.PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }
`;

const templatePath = path.join(__dirname, '../html/widget.html');
let widgetTemplate = '';

try {
  widgetTemplate = fs.readFileSync(templatePath, 'utf8');
  console.log('Widget template loaded successfully');
} catch (error) {
  console.error('Failed to load widget template:', error.message);
  widgetTemplate = '<!DOCTYPE html><html><body><h1>Widget template not found</h1></body></html>';
}

function renderWidgetHtml(voteKey = '') {
  const apiBase = process.env.API_BASE || 'https://widgets-api.novaconsortium.org/api';
  
  return widgetTemplate
    .replace('{{API_BASE}}', apiBase)
    .replace('{{BOND_ADDRESS_SCRIPT}}', getBondAddressScript)
    .replace('{{VOTE_KEY}}', voteKey);
}

router.get('/:voteKey', (req, res) => {
  res.send(renderWidgetHtml(req.params.voteKey));
});

router.get('/', (req, res) => {
  res.send(renderWidgetHtml());
});

module.exports = router;
