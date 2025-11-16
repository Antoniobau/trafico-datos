const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
router.post('/register', async (req,res)=>{ const { email, password, name } = req.body; const ph = await bcrypt.hash(password, 10); try { const r = await pool.query('INSERT INTO users (email,password_hash,name,role) VALUES ($1,$2,$3,$4) RETURNING id', [email, ph, name, 'advertiser']); const userId = r.rows[0].id; await pool.query('INSERT INTO wallets (user_id,balance_numeric) VALUES ($1,$2)', [userId, 0]); res.json({ ok:true, userId }); } catch(e){ console.error(e); res.status(500).json({ error:'register failed' }); } });
router.post('/login', async (req,res)=>{ const { email, password } = req.body; const r = await pool.query('SELECT * FROM users WHERE email=$1', [email]); if(!r.rowCount) return res.status(401).json({error:'invalid'}); const user = r.rows[0]; const match = await bcrypt.compare(password, user.password_hash||''); if(!match) return res.status(401).json({error:'invalid'}); const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || 'dev', { expiresIn: '7d' }); res.json({ token, user:{ id:user.id, email: user.email, role: user.role } }); });
module.exports = router;
