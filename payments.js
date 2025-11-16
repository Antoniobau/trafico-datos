const express = require('express');
const router = express.Router();
const paypal = require('@paypal/checkout-server-sdk');
const { pool } = require('../db');
function paypalClient(){ const clientId = process.env.PAYPAL_CLIENT_ID; const secret = process.env.PAYPAL_SECRET; const env = process.env.PAYPAL_MODE === 'live' ? new paypal.core.LiveEnvironment(clientId, secret) : new paypal.core.SandboxEnvironment(clientId, secret); return new paypal.core.PayPalHttpClient(env); }

router.post('/create-order', async (req,res)=>{
  const { amount, userId } = req.body;
  if(!amount || !userId) return res.status(400).json({error:'missing'});
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({ intent:'CAPTURE', purchase_units:[{ amount:{ currency_code:'USD', value: amount.toString() } }] });
  try { const client = paypalClient(); const order = await client.execute(request); await pool.query('INSERT INTO payments (user_id,paypal_order_id,amount,currency,status,raw_response) VALUES ($1,$2,$3,$4,$5,$6)', [userId, order.result.id, amount, 'USD', 'CREATED', order.result]); res.json({ orderID: order.result.id, links: order.result.links }); } catch(e){ console.error(e); res.status(500).json({ error:'create-order-failed' }); }
});

router.post('/capture', async (req,res)=>{
  const { orderID, userId } = req.body;
  if(!orderID) return res.status(400).json({error:'no order id'});
  try { const client = paypalClient(); const request = new paypal.orders.OrdersCaptureRequest(orderID); request.requestBody({}); const resp = await client.execute(request); const amount = parseFloat(resp.result.purchase_units[0].payments.captures[0].amount.value || 0); await pool.query('UPDATE payments SET status=$1, raw_response=$2 WHERE paypal_order_id=$3', ['COMPLETED', resp.result, orderID]); if(userId){ const credits = Math.floor(amount * parseInt(process.env.CREDITS_PER_USD || '1000')); await pool.query('UPDATE wallets SET balance_numeric = balance_numeric + $1 WHERE user_id=$2', [credits, userId]); } res.json({ ok:true, credits: amount }); } catch(e){ console.error('capture err', e); res.status(500).json({error:'capture-failed'}); }
});

router.post('/webhook', async (req,res)=>{ const event = req.body; console.log('paypal webhook', event.event_type); res.status(200).send('ok'); });

module.exports = router;
