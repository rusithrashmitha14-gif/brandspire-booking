const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qYm9yamVicmN6cW5kbGN6cmVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjM0NjYsImV4cCI6MjA5NjMzOTQ2Nn0._apChVU1LJZU5T8vTL_GA8Rv3Mdok8ZR_7JoHi5z6Zk';
const url = 'https://ojborjebrczqndlczrec.supabase.co/rest/v1/room_types?limit=1';

async function test() {
  const pRes = await fetch(url, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }});
  const data = await pRes.json();
  console.log("Columns:", Object.keys(data[0] || {}));
}

test();
