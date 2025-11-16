const express = require('express');
const router = express.Router();
const { pool } = require('../db');
router.post('/trial', async (req,res)=>{ const { userId, plan='pro' } = req.body; const trialEnds = new Date(Date.now() + 3*24*60*60*1000); const r = await pool.query('INSERT INTO subscriptions (user_id,plan,status,trial_expires_at,started_at) VALUES ($1,$2,$3,$4, now()) RETURNING *', [userId, plan, 'trial', trialEnds]); res.json({ ok:true, subscription: r.rows[0] }); });
module.exports = router;
