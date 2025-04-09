const pool = require('./config/db');

async function test() {
  try {
    const res = await pool.query('SELECT NOW();');
    console.log('Connexion réussie :', res.rows[0]);
  } catch (err) {
    console.error('Erreur :', err.message);
  }
}

test();