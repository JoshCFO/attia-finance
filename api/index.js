const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(plaidConfig);

const accessTokens = [];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const path = req.url.replace('/api', '');

  try {
    if (path === '/status') {
      return res.json({ connected: accessTokens.length });
    }
    if (path === '/create-link-token' && req.method === 'POST') {
      const r = await plaidClient.linkTokenCreate({
        user: { client_user_id: 'attia-family' },
        client_name: 'Attia Family Finance',
        products: ['transactions'],
        country_codes: ['US'],
        language: 'en',
      });
      return res.json({ link_token: r.data.link_token });
    }
    if (path === '/exchange-token' && req.method === 'POST') {
      const { public_token } = req.body;
      const r = await plaidClient.itemPublicTokenExchange({ public_token });
      accessTokens.push(r.data.access_token);
      return res.json({ success: true });
    }
    if (path === '/balances') {
      const allAccounts = [];
      for (const token of accessTokens) {
        const r = await plaidClient.accountsBalanceGet({ access_token: token });
        allAccounts.push(...r.data.accounts);
      }
      return res.json({ accounts: allAccounts });
    }
    if (path === '/transactions') {
      const allTx = [];
      for (const token of accessTokens) {
        let cursor = null, hasMore = true;
        while (hasMore) {
          const r = await plaidClient.transactionsSync({ access_token: token, cursor: cursor || undefined });
          allTx.push(...r.data.added);
          cursor = r.data.next_cursor;
          hasMore = r.data.has_more;
        }
      }
      return res.json({ transactions: allTx });
    }
    if (path === '/liabilities') {
      return res.json({ credit: [], mortgage: [], student: [] });
    }
    return res.status(404).json({ error: 'Not found' });
  } catch (e) {
    return res.status(500).json({ error: e.response?.data || e.message });
  }
};
