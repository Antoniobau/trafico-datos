require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
(async ()=>{
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync('migrations/001_init.sql','utf8');
  try {
    await pool.query(sql);
    console.log('Migrations executed');
    process.exit(0);
  } catch(e){
    console.error('Migration error', e);
    process.exit(1);
  }
})();
