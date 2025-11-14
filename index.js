require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const paypal = require('@paypal/checkout-server-sdk');
const { pool } = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const CREDITS_PER_USD = parseInt(process.env.CREDITS_PER_USD || '1000', 10);

// PayPal client
function paypalClient(){
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  const env = process.env.PAYPAL_MODE === 'live'
    ? new paypal.core.LiveEnvironment(clientId, secret)
    : new paypal.core.SandboxEnvironment(clientId, secret);
  return new paypal.core.PayPalHttpClient(env);
}

// Simple auth
app.post('/api/auth/register', async (req, res) => {
  const { email, password, role='advertiser', name } = req.body;
  if(!email || !password) return res.status(400).json({error:'email and password required'});
  const ph = await bcrypt.hash(password, 10);
  try {
    const r = await pool.query('INSERT INTO users (email, password_hash, role, name) VALUES ($1,$2,$3,$4) RETURNING id', [email, ph, role, name]);
    const userId = r.rows[0].id;
    // create wallet
    await pool.query('INSERT INTO wallets (user_id, balance_numeric) VALUES ($1, $2)', [userId, 0]);
    res.json({ ok: true, userId });
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'register failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const r = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  if(r.rowCount===0) return res.status(401).json({ error:'invalid' });
  const user = r.rows[0];
  const match = await bcrypt.compare(password, user.password_hash || '');
  if(!match) return res.status(401).json({ error:'invalid' });
  const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || 'dev', { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
});

app.get('/api/auth/me', async (req, res) => {
  const h = req.headers.authorization;
  if(!h) return res.status(401).json({ error:'no auth' });
  const token = h.replace('Bearer ','');
  try {
    const data = jwt.verify(token, process.env.JWT_SECRET || 'dev');
    const r = await pool.query('SELECT id,email,role,name FROM users WHERE id=$1', [data.userId]);
    res.json({ user: r.rows[0] });
  } catch(e){
    res.status(401).json({ error:'invalid token' });
  }
});

// Create PayPal order
app.post('/api/payments/create-order', async (req, res) => {
  const { amount, currency='USD', userId } = req.body;
  if(!amount || !userId) return res.status(400).json({ error:'amount and userId required' });
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{ amount: { currency_code: currency, value: amount.toString() } }],
    application_context: {
      return_url: process.env.PAYPAL_RETURN_URL || 'https://example.com/success',
      cancel_url: process.env.PAYPAL_CANCEL_URL || 'https://example.com/cancel'
    }
  });
  try {
    const client = paypalClient();
    const order = await client.execute(request);
    await pool.query(`INSERT INTO payments (user_id, paypal_order_id, amount, currency, status, raw_response, created_at)
      VALUES ($1,$2,$3,$4,$5,$6, now())`, [userId, order.result.id, amount, currency, 'CREATED', order.result]);
    res.json({ orderID: order.result.id, links: order.result.links });
  } catch(err){
    console.error('create-order err', err);
    res.status(500).json({ error:'create-order-failed' });
  }
});

// Capture (safe to call multiple times)
app.post('/api/payments/capture-order', async (req, res) => {
  const { orderID, userId } = req.body;
  if(!orderID || !userId) return res.status(400).json({ error:'orderID and userId required' });
  try {
    const client = paypalClient();
    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});
    const captureResp = await client.execute(request);
    await pool.query(`UPDATE payments SET status=$1, raw_response=$2 WHERE paypal_order_id=$3`, ['COMPLETED', captureResp.result, orderID]);
    const amount = parseFloat(captureResp.result.purchase_units[0].payments.captures[0].amount.value || captureResp.result.purchase_units[0].amount.value || 0);
    const credits = Math.floor(amount * CREDITS_PER_USD);
    if(userId){
      await pool.query('UPDATE wallets SET balance_numeric = balance_numeric + $1 WHERE user_id=$2', [credits, userId]);
    }
    res.json({ ok:true, credits, capture: captureResp.result });
  } catch(err){
    console.error('capture err', err);
    res.status(500).json({ error:'capture-failed', details: err.toString() });
  }
});

// Webhook - reconcile by fetching order
app.post('/api/payments/webhook', async (req, res) => {
  const event = req.body;
  try {
    const resource = event.resource || {};
    const orderId = resource.id || resource.order_id || (resource.supplementary_data && resource.supplementary_data.related_ids && resource.supplementary_data.related_ids.order_id);
    if(!orderId){
      console.warn('webhook without order id', event.type);
      return res.status(200).send('no-order-id');
    }
    const client = paypalClient();
    const reqOrder = new paypal.orders.OrdersGetRequest(orderId);
    const orderResp = await client.execute(reqOrder);
    const order = orderResp.result;
    const r = await pool.query('SELECT * FROM payments WHERE paypal_order_id=$1', [orderId]);
    if(r.rowCount === 0){
      await pool.query(`INSERT INTO payments (user_id, paypal_order_id, amount, currency, status, raw_response, created_at)
        VALUES ($1,$2,$3,$4,$5,$6, now())`, [null, orderId, null, null, 'UNKNOWN', order]);
      return res.status(200).send('ok');
    }
    const payment = r.rows[0];
    const isCompleted = (
      order.status === 'COMPLETED' ||
      (order.purchase_units && order.purchase_units[0].payments && order.purchase_units[0].payments.captures
        && order.purchase_units[0].payments.captures.some(c => c.status === 'COMPLETED'))
    );
    if(isCompleted && payment.status !== 'COMPLETED'){
      let amount = null;
      try {
        const capture = order.purchase_units[0].payments.captures.find(c=>c.status==='COMPLETED');
        amount = capture ? parseFloat(capture.amount.value) : (order.purchase_units[0].amount && parseFloat(order.purchase_units[0].amount.value));
      } catch(e){}
      await pool.query(`UPDATE payments SET status=$1, raw_response=$2 WHERE paypal_order_id=$3`, ['COMPLETED', order, orderId]);
      if(payment.user_id && amount){
        const credits = Math.floor(amount * CREDITS_PER_USD);
        await pool.query('UPDATE wallets SET balance_numeric = balance_numeric + $1 WHERE user_id=$2', [credits, payment.user_id]);
      }
    }
    res.status(200).send('processed');
  } catch(err){
    console.error('webhook err', err);
    res.status(500).send('webhook-error');
  }
});

// Tracking endpoint (pixel)
app.post('/api/track', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ua = req.body.ua || req.headers['user-agent'] || '';
  const { campaign, pub, type='impression', url } = req.body;
  const fingerprint = require('crypto').createHash('sha1').update(ua + ip + (req.body.screen?.w||'')).digest('hex');
  try {
    await pool.query(`INSERT INTO events (campaign_id, publisher_id, event_type, ip, user_agent, fingerprint, referrer, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7, now())`, [campaign, pub, type, ip, ua, fingerprint, url]);
    // basic: respond 204
    res.status(204).end();
  } catch(e){
    console.error('track err', e);
    res.status(500).json({ error:'track error' });
  }
});

app.get('/health', (req, res) => res.json({ok:true, time: new Date()}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Server listening on', PORT));
