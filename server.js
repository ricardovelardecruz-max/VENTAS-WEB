const express = require('express');
const path = require('path');
const { createClient } = require('@libsql/client');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Base de datos ---
// Usa Turso (SQLite en la nube) para que los datos NUNCA se borren, aunque
// el servidor se reinicie o el hosting no tenga disco persistente.
//
// En LOCAL (tu computadora): si no defines las variables de entorno,
// usa un archivo local llamado ventas.db (solo para pruebas).
//
// En PRODUCCIÓN (Render/Railway/etc): define las variables de entorno
// TURSO_DATABASE_URL y TURSO_AUTH_TOKEN (ver README para instrucciones).
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:ventas.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

async function iniciarDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cantidad INTEGER NOT NULL,
      monto REAL NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'entrada',
      fecha TEXT NOT NULL
    )
  `);

  // Migración: si la tabla ya existía de antes (sin la columna "tipo"),
  // la agregamos ahora. Si ya existe, SQLite lanza un error que ignoramos.
  try {
    await db.execute(`ALTER TABLE ventas ADD COLUMN tipo TEXT NOT NULL DEFAULT 'entrada'`);
  } catch (err) {
    // La columna ya existe: no pasa nada.
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Rutas API ---

// Comprobación sencilla para monitoreo y despliegues.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Registrar una venta nueva
app.post('/api/ventas', async (req, res) => {
  try {
    const { cantidad, monto, tipo } = req.body;
    const tipoFinal = tipo === 'salida' ? 'salida' : 'entrada';

    if (cantidad === undefined || monto === undefined || cantidad === '' || monto === '') {
      return res.status(400).json({ error: 'Faltan datos: cantidad y monto son obligatorios' });
    }

    const cantidadNum = Number(cantidad);
    const montoNum = Number(monto);

    if (isNaN(cantidadNum) || isNaN(montoNum) || cantidadNum <= 0 || montoNum <= 0) {
      return res.status(400).json({ error: 'Cantidad y monto deben ser números positivos' });
    }

    const fecha = new Date().toISOString();

    const resultado = await db.execute({
      sql: 'INSERT INTO ventas (cantidad, monto, tipo, fecha) VALUES (?, ?, ?, ?)',
      args: [cantidadNum, montoNum, tipoFinal, fecha],
    });

    res.json({ ok: true, id: Number(resultado.lastInsertRowid) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor al guardar la venta' });
  }
});

// Obtener todas las ventas
app.get('/api/ventas', async (req, res) => {
  try {
    const resultado = await db.execute('SELECT * FROM ventas ORDER BY id DESC');
    res.json(resultado.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor al leer las ventas' });
  }
});

// Obtener totales
app.get('/api/totales', async (req, res) => {
  try {
    const resultado = await db.execute(`
      SELECT
        COALESCE(SUM(cantidad), 0) as totalCantidad,
        COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE 0 END), 0) as totalEntradas,
        COALESCE(SUM(CASE WHEN tipo = 'salida' THEN monto ELSE 0 END), 0) as totalSalidas,
        COUNT(*) as totalVentas
      FROM ventas
    `);
    const fila = resultado.rows[0];
    const totalEntradas = Number(fila.totalEntradas);
    const totalSalidas = Number(fila.totalSalidas);

    res.json({
      totalCantidad: fila.totalCantidad,
      totalVentas: fila.totalVentas,
      totalEntradas,
      totalSalidas,
      totalMonto: totalEntradas - totalSalidas, // balance neto
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor al calcular totales' });
  }
});

// Borrar una venta (por si se equivocan al anotar)
app.delete('/api/ventas/:id', async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM ventas WHERE id = ?',
      args: [req.params.id],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor al borrar' });
  }
});

async function startServer(port = PORT) {
  await iniciarDB();
  return app.listen(port, () => {
    console.log(`Servidor corriendo en el puerto ${port}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('No se pudo iniciar el servidor:', error);
    process.exitCode = 1;
  });
}

module.exports = { app, iniciarDB, startServer };
