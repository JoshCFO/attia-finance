const express = require('express');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: ['https://attia-finance1.vercel.app'] }));
app.use(express.json());

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(plaidConfig);

const accessTokens = [];

app.post('/api/create-link-token', async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'attia-family' },
      client_name: 'Attia Family Finance',
      products: ['transactions', 'liabilities', 'investments'],
      country_codes: ['US'],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.post('/api/exchange-token', async (req, res) => {
  try {
    const { public_token } = req.body;
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    accessTokens.push(response.data.access_token);
    res.json({ success: true, count: accessTokens.length });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.get('/api/balances', async (req, res) => {
  try {
    const allAccounts = [];
    for (const token of accessTokens) {
      const r = await plaidClient.accountsBalanceGet({ access_token: token });
      allAccounts.push(...r.data.accounts);
    }
    res.json({ accounts: allAccounts });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const allTx = [];
    for (const token of accessTokens) {
      let cursor = null, hasMore = true;
      while (hasMore) {
        const r = await plaidClient.transactionsSync({
          access_token: token,
          cursor: cursor || undefined,
        });
        allTx.push(...r.data.added);
        cursor = r.data.next_cursor;
        hasMore = r.data.has_more;
      }
    }
    res.json({ transactions: allTx });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.get('/api/liabilities', async (req, res) => {
  try {
    const allLiabilities = { credit: [], mortgage: [], student: [] };
    for (const token of accessTokens) {
      try {
        const r = await plaidClient.liabilitiesGet({ access_token: token });
        const l = r.data.liabilities;
        if (l.credit) allLiabilities.credit.push(...l.credit);
        if (l.mortgage) allLiabilities.mortgage.push(...l.mortgage);
        if (l.student) allLiabilities.student.push(...l.student);
      } catch(e) {}
    }
    res.json(allLiabilities);
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ connected: accessTokens.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Attia Finance API running on port ${PORT}`));
module.exports = app;
