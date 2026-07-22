const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');

const { startServer } = require('../server');

let server;
let baseUrl;

before(async () => {
  server = await startServer(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => new Promise((resolve, reject) => {
  server.close((error) => (error ? reject(error) : resolve()));
}));

test('GET /api/health confirma que el servicio está disponible', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: 'ok' });
});

test('POST /api/ventas rechaza cantidades inválidas', async () => {
  const response = await fetch(`${baseUrl}/api/ventas`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cantidad: 0, monto: 100, tipo: 'entrada' }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /números positivos/i);
});
