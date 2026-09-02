import pg from 'pg';
import { readFileSync } from 'fs';

const { Client } = pg;
const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error('SUPABASE_DB_URL not set');
  process.exit(1);
}

const sql = readFileSync('supabase/migrations/0004_custody_backend.sql', 'utf-8');
const client = new Client({ connectionString: dbUrl });

await client.connect();
await client.query(sql);
await client.end();

console.log('Migration 0004 applied successfully');
