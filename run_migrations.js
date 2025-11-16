require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async()=>{
  const sql = fs.readFileSync('./migrations/001_init.sql','utf8') + '\n' + fs.readFileSync('./migrations/002_subscriptions.sql','utf8');
  try { await pool.query(sql); console.log('migrations executed'); process.exit(0); } catch(e){ console.error('migrate err', e); process.exit(1); }
})();
