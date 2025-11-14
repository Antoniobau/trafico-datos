require('dotenv').config();
const paypal = require('@paypal/checkout-server-sdk');
const { pool } = require('./db');
const TelegramBot = require('node-telegram-bot-api');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CHECK_INTERVAL_MIN = parseInt(process.env.BOT_CHECK_INTERVAL_MIN || '5', 10);
const CREDITS_PER_USD = parseInt(process.env.CREDITS_PER_USD || '1000', 10);

const bot = TELEGRAM_TOKEN ? new TelegramBot(TELEGRAM_TOKEN) : null;
function sendTelegram(msg){
  if(!bot || !CHAT_ID) return console.log('TG not configured:', msg);
  bot.sendMessage(CHAT_ID, msg).catch(e => console.error('tg send err', e));
}

function paypalClient(){
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  const env = process.env.PAYPAL_MODE === 'live'
    ? new paypal.core.LiveEnvironment(clientId, secret)
    : new paypal.core.SandboxEnvironment(clientId, secret);
  return new paypal.core.PayPalHttpClient(env);
}

async function checkPendingPayments(){
  try {
    const res = await pool.query(`SELECT * FROM payments WHERE status != 'COMPLETED' ORDER BY created_at ASC LIMIT 50`);
    if(res.rowCount === 0) return;
    const client = paypalClient();
    for(const p of res.rows){
      const orderId = p.paypal_order_id;
      if(!orderId) continue;
      try {
        const req = new paypal.orders.OrdersGetRequest(orderId);
        const r = await client.execute(req);
        const order = r.result;
        if(order.status === 'APPROVED'){
          try {
            const captureReq = new paypal.orders.OrdersCaptureRequest(orderId);
            captureReq.requestBody({});
            const capResp = await client.execute(captureReq);
            await pool.query(`UPDATE payments SET status=$1, raw_response=$2 WHERE paypal_order_id=$3`, ['COMPLETED', capResp.result, orderId]);
            const amount = parseFloat(capResp.result.purchase_units[0].payments.captures[0].amount.value || 0);
            if(p.user_id && amount){
              const credits = Math.floor(amount * CREDITS_PER_USD);
              await pool.query('UPDATE wallets SET balance_numeric = balance_numeric + $1 WHERE user_id=$2', [credits, p.user_id]);
              sendTelegram(`Bot: Orden ${orderId} capturada y acreditados ${credits} créditos al usuario ${p.user_id} (monto ${amount} ${p.currency})`);
            } else {
              sendTelegram(`Bot: Orden ${orderId} capturada pero falta user_id/amount para acreditar.`);
            }
          } catch(capErr){
            console.error('capture err', capErr);
            sendTelegram(`Bot: Error capturando ${orderId}: ${capErr.message || capErr}`);
          }
        } else if(order.status === 'COMPLETED' || (order.purchase_units && order.purchase_units[0].payments && order.purchase_units[0].payments.captures && order.purchase_units[0].payments.captures.some(c=>c.status==='COMPLETED'))){
          let amount = null;
          try {
            const capture = order.purchase_units[0].payments.captures.find(c => c.status === 'COMPLETED');
            amount = capture ? parseFloat(capture.amount.value) : null;
          } catch(e){}
          await pool.query(`UPDATE payments SET status=$1, raw_response=$2 WHERE paypal_order_id=$3`, ['COMPLETED', order, orderId]);
          if(p.user_id && amount){
            const credits = Math.floor(amount * CREDITS_PER_USD);
            await pool.query('UPDATE wallets SET balance_numeric = balance_numeric + $1 WHERE user_id=$2', [credits, p.user_id]);
            sendTelegram(`Bot: Orden ${orderId} ya completada; acreditados ${credits} créditos al usuario ${p.user_id}`);
          } else {
            sendTelegram(`Bot: Orden ${orderId} completada pero faltan datos (user_id/amount).`);
          }
        } else {
          console.log('order', orderId, 'status', order.status);
        }
      } catch(orderErr){
        console.error('error fetching order', orderId, orderErr);
        sendTelegram(`Bot: Error consultando orden ${orderId}: ${orderErr.message || orderErr}`);
      }
    }
  } catch(e){
    console.error('checkPendingPayments err', e);
    sendTelegram(`Bot: Error general en checkPendingPayments: ${e.message || e}`);
  }
}

(async function main(){
  console.log('Backup bot starting - interval', CHECK_INTERVAL_MIN, 'min');
  sendTelegram && sendTelegram('Bot: Servicio de respaldo iniciado.');
  await checkPendingPayments();
  setInterval(checkPendingPayments, CHECK_INTERVAL_MIN * 60 * 1000);
})();
