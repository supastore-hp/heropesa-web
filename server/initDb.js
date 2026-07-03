const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function init() {
  const dbName = process.env.DB_NAME || 'heropesa_pos';
  const client1 = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: 'postgres'
  });

  try {
    await client1.connect();
    const res = await client1.query("SELECT datname FROM pg_database WHERE datname = $1", [dbName]);
    if (res.rows.length === 0) {
      console.log(`Creating database ${dbName}...`);
      await client1.query(`CREATE DATABASE "${dbName}"`);
    } else {
      console.log(`Database ${dbName} already exists.`);
    }
  } catch (err) {
    console.error('Error connecting to postgres default db:', err);
    process.exit(1);
  } finally {
    await client1.end();
  }

  const client2 = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: dbName
  });

  try {
    await client2.connect();
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client2.query(schemaSql);
    console.log('Schema executed successfully.');
  } catch (err) {
    console.error('Error executing schema.sql:', err);
  } finally {
    await client2.end();
  }
}

init();
