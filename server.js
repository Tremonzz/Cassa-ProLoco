const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { exec } = require('child_process');
const { generateReceiptBuffer: generateCompactReceipt } = require('./templates/receipt_compact');
const { generateSplitReceipt } = require('./templates/receipt_split');
const { printRawBuffer } = require('./print_service');

// When packaged, __dirname is inside app.asar (read-only).
// Writable files (DB, temp) should go next to the exe / outside asar.
const appRoot = __dirname.includes('app.asar')
  ? path.dirname(__dirname.replace('app.asar', ''))
  : __dirname;

// Determine best location for writable data (DB)
// Standard place: Electron's userData folder. 
// Old place (1.0.0): appRoot (next to exe).
let dbPath;
try {
  // We try to get the Electron app object to find the userData path.
  // require('electron') works here because server.js is required by main.js.
  const { app: electronApp } = require('electron');
  const userDataPath = electronApp.getPath('userData');
  const dbPathInUserData = path.join(userDataPath, 'sagra.db');
  const dbPathInRoot = path.join(appRoot, 'sagra.db');

  // MIGRATION: If DB exists in old location but not new, move it.
  if (fs.existsSync(dbPathInRoot) && !fs.existsSync(dbPathInUserData)) {
    console.log("--- Migration 1.0.1: Copying DB to UserData ---");
    fs.copyFileSync(dbPathInRoot, dbPathInUserData);
  }

  dbPath = dbPathInUserData;
} catch (e) {
  // If we're running without Electron (e.g. node server.js development), stick to appRoot.
  dbPath = path.join(appRoot, 'sagra.db');
}

const app = express();
const port = 3000;
let db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("DB Open Error:", err);
  else console.log(`Connected to SQlite DB at: ${dbPath}`);
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Serve resized header image from OS temp dir or fallback
app.get('/receipt_header_resized.png', async (req, res) => {
  const resizedPath = path.join(os.tmpdir(), 'receipt_header_resized.png');
  if (fs.existsSync(resizedPath)) {
    return res.sendFile(resizedPath);
  }
  let originalPath = path.join(__dirname, 'public', 'images', 'receipt_header.png');
  const unpackedPath = originalPath.replace('app.asar', 'app.asar.unpacked');
  if (fs.existsSync(unpackedPath)) {
    originalPath = unpackedPath;
  }
  if (fs.existsSync(originalPath)) {
    try {
      const sharp = require('sharp');
      await sharp(originalPath)
        .resize({ width: 380 })
        .toFile(resizedPath);
      return res.sendFile(resizedPath);
    } catch (e) {
      return res.sendFile(originalPath);
    }
  }
  res.status(404).send('Not found');
});

// Helper for Promisified DB Run
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function (err, row) {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function (err, rows) {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function queryDbRun(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// --- Database Setup ---
function runMigrations() {
  db.serialize(() => {
    // Sagras
    db.run(`
      CREATE TABLE IF NOT EXISTS sagras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      db.run("ALTER TABLE sagras ADD COLUMN status TEXT DEFAULT 'active'", (e) => { });
    });

    db.run("PRAGMA foreign_keys=OFF");

    // Categories
    db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        is_hidden INTEGER DEFAULT 0,
        sagra_id INTEGER DEFAULT 1
      )
    `, (err) => {
      db.run("ALTER TABLE categories ADD COLUMN is_hidden INTEGER DEFAULT 0", (e) => { });
    });

    // Products
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER DEFAULT NULL,
        is_composite INTEGER DEFAULT 0,
        category_id INTEGER,
        FOREIGN KEY(category_id) REFERENCES categories(id)
      )
    `, (err) => {
      // Migration for existing tables
      db.run("ALTER TABLE products ADD COLUMN quantity INTEGER DEFAULT NULL", (e) => {
        if (!e) console.log("Migration: Added 'quantity' column to products.");
      });
      db.run("ALTER TABLE products ADD COLUMN is_composite INTEGER DEFAULT 0", (e) => {
        if (!e) console.log("Migration: Added 'is_composite' column to products.");
      });
      db.run("ALTER TABLE products ADD COLUMN components TEXT DEFAULT NULL", (e) => {
        if (!e) console.log("Migration: Added 'components' column to products.");
      });
      db.run("ALTER TABLE products ADD COLUMN is_selection INTEGER DEFAULT 0", (e) => {
        if (!e) console.log("Migration: Added 'is_selection' column to products.");
      });
      db.run("ALTER TABLE products ADD COLUMN position INTEGER DEFAULT 0", (e) => {
        if (!e) console.log("Migration: Added 'position' column to products.");
      });
      db.run("ALTER TABLE products ADD COLUMN type TEXT DEFAULT 'simple'", (e) => {
        if (!e) {
          console.log("Migration: Added 'type' column to products.");
          db.run("UPDATE products SET type = 'composite' WHERE is_composite = 1");
          db.run("UPDATE products SET type = 'selection' WHERE is_selection = 1");
        }
      });
    });

    // Orders
    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seq INTEGER DEFAULT 0,
        total REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sagra_id INTEGER DEFAULT 1
      )
    `, (err) => {
      db.run("ALTER TABLE orders ADD COLUMN seq INTEGER DEFAULT 0", (e) => { });
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY(order_id) REFERENCES orders(id)
      )
    `);

    // Base Products Table
    db.run(`
      CREATE TABLE IF NOT EXISTS base_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        quantity INTEGER DEFAULT NULL,
        sagra_id INTEGER DEFAULT 1
      )
    `);

    // Ensure default Sagra exists
    db.get("SELECT count(*) as count FROM sagras", (err, row) => {
      if (row && row.count === 0) {
        db.run("INSERT INTO sagras (id, name, status) VALUES (1, 'Evento Default', 'active')");
      }
    });
  });
}

// Run migrations on startup
runMigrations();

// --- DATABASE MANAGEMENT APIs ---
app.get('/api/database/export', (req, res) => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const filename = `eventi${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}.db`;
  res.download(dbPath, filename, (err) => {
    if (err) {
      console.error("Export Error:", err);
    }
  });
});

// Inspect active database sagras for selective export
app.get('/api/database/export-inspect', async (req, res) => {
  try {
    const sagrasQuery = `
      SELECT s.id, s.name, s.status, s.created_at,
        (SELECT COUNT(*) FROM categories c WHERE c.sagra_id = s.id) as category_count,
        (SELECT COUNT(*) FROM products p JOIN categories c ON p.category_id = c.id WHERE c.sagra_id = s.id) as product_count,
        (SELECT COUNT(*) FROM orders o WHERE o.sagra_id = s.id) as order_count,
        (SELECT COUNT(*) FROM base_products bp WHERE bp.sagra_id = s.id) as base_product_count
      FROM sagras s
      ORDER BY s.created_at DESC
    `;
    const sagras = await dbAll(sagrasQuery);
    res.json({ success: true, sagras });
  } catch (e) {
    console.error("Export inspect error:", e);
    res.status(500).json({ error: "Errore durante il caricamento degli eventi: " + e.message });
  }
});

// Export selected sagras to a new SQLite database file
app.post('/api/database/export-selected', async (req, res) => {
  const { selectedSagraIds } = req.body;
  if (!Array.isArray(selectedSagraIds) || selectedSagraIds.length === 0) {
    return res.status(400).json({ error: "Nessun evento selezionato per l'esportazione." });
  }

  const exportTempPath = path.join(appRoot, `export_temp_${Date.now()}.db`);
  let exportDb = null;

  try {
    exportDb = new sqlite3.Database(exportTempPath);

    // Initialize table structure in exportDb
    await new Promise((resolve, reject) => {
      exportDb.serialize(() => {
        exportDb.run(`CREATE TABLE IF NOT EXISTS sagras (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        exportDb.run("PRAGMA foreign_keys=OFF");
        exportDb.run(`CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, is_hidden INTEGER DEFAULT 0, sagra_id INTEGER DEFAULT 1)`);
        exportDb.run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price REAL NOT NULL, quantity INTEGER DEFAULT NULL, is_composite INTEGER DEFAULT 0, components TEXT DEFAULT NULL, is_selection INTEGER DEFAULT 0, position INTEGER DEFAULT 0, type TEXT DEFAULT 'simple', category_id INTEGER, FOREIGN KEY(category_id) REFERENCES categories(id))`);
        exportDb.run(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, seq INTEGER DEFAULT 0, total REAL NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, sagra_id INTEGER DEFAULT 1)`);
        exportDb.run(`CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, product_name TEXT NOT NULL, quantity INTEGER NOT NULL, price REAL NOT NULL, FOREIGN KEY(order_id) REFERENCES orders(id))`);
        exportDb.run(`CREATE TABLE IF NOT EXISTS base_products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, quantity INTEGER DEFAULT NULL, sagra_id INTEGER DEFAULT 1)`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    for (const sagraId of selectedSagraIds) {
      const sagra = await dbGet("SELECT * FROM sagras WHERE id = ?", [sagraId]);
      if (!sagra) continue;

      await queryDbRun(exportDb, "INSERT INTO sagras (id, name, status, created_at) VALUES (?, ?, ?, ?)", [
        sagra.id,
        sagra.name,
        sagra.status || 'active',
        sagra.created_at || new Date().toISOString()
      ]);

      const categories = await dbAll("SELECT * FROM categories WHERE sagra_id = ?", [sagraId]);
      for (const cat of categories) {
        await queryDbRun(exportDb, "INSERT INTO categories (id, name, is_hidden, sagra_id) VALUES (?, ?, ?, ?)", [
          cat.id,
          cat.name,
          cat.is_hidden || 0,
          cat.sagra_id
        ]);

        const products = await dbAll("SELECT * FROM products WHERE category_id = ?", [cat.id]);
        for (const p of products) {
          await queryDbRun(exportDb, "INSERT INTO products (id, name, price, quantity, type, is_composite, is_selection, components, category_id, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
            p.id,
            p.name,
            p.price,
            p.quantity,
            p.type,
            p.is_composite,
            p.is_selection,
            p.components,
            p.category_id,
            p.position
          ]);
        }
      }

      const baseProducts = await dbAll("SELECT * FROM base_products WHERE sagra_id = ?", [sagraId]);
      for (const bp of baseProducts) {
        await queryDbRun(exportDb, "INSERT INTO base_products (id, name, quantity, sagra_id) VALUES (?, ?, ?, ?)", [
          bp.id,
          bp.name,
          bp.quantity,
          bp.sagra_id
        ]);
      }

      const orders = await dbAll("SELECT * FROM orders WHERE sagra_id = ?", [sagraId]);
      for (const ord of orders) {
        await queryDbRun(exportDb, "INSERT INTO orders (id, seq, total, created_at, sagra_id) VALUES (?, ?, ?, ?, ?)", [
          ord.id,
          ord.seq,
          ord.total,
          ord.created_at,
          ord.sagra_id
        ]);

        const orderItems = await dbAll("SELECT * FROM order_items WHERE order_id = ?", [ord.id]);
        for (const item of orderItems) {
          await queryDbRun(exportDb, "INSERT INTO order_items (id, order_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)", [
            item.id,
            item.order_id,
            item.product_name,
            item.quantity,
            item.price
          ]);
        }
      }
    }

    await closeDb(exportDb);

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const filename = `eventi${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}.db`;

    res.download(exportTempPath, filename, (err) => {
      if (err) console.error("Export download error:", err);
      if (fs.existsSync(exportTempPath)) {
        try { fs.unlinkSync(exportTempPath); } catch (e) {}
      }
    });
  } catch (e) {
    console.error("Export Selected error:", e);
    if (exportDb) {
      await closeDb(exportDb);
    }
    if (fs.existsSync(exportTempPath)) {
      try { fs.unlinkSync(exportTempPath); } catch (e) {}
    }
    res.status(500).json({ error: "Errore esportazione selettiva: " + e.message });
  }
});

app.post('/api/database/import', (req, res) => {
  const tempPath = path.join(appRoot, 'temp_import.db');

  const writeStream = fs.createWriteStream(tempPath);

  req.pipe(writeStream);

  writeStream.on('finish', () => {
    // File upload complete
    db.close((err) => {
      if (err) {
        console.error("Error closing DB:", err);
        return res.status(500).send("Error closing current DB");
      }

      try {
        // Wait a tiny bit for file lock release (Windows quirk)
        setTimeout(() => {
          // Replace DB file
          if (fs.existsSync(dbPath)) {
            // Backup optionally? No user request yet.
            fs.unlinkSync(dbPath);
          }
          fs.copyFileSync(tempPath, dbPath);
          fs.unlinkSync(tempPath);

          // Re-open
          db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
              console.error("Reopen Error:", err);
              return res.status(500).send("Database corrupted");
            }
            // Run migrations on the imported DB
            runMigrations();
            console.log("Database hot-swapped successfully.");
            res.json({ success: true });
          });
        }, 500); // 500ms safety delay
      } catch (e) {
        console.error("File Swap Error:", e);
        res.status(500).send("Error swapping DB file");
      }
    });
  });

  writeStream.on('error', (err) => {
    console.error("Upload Stream Error:", err);
    res.status(500).send("Upload failed");
  });
});

// Helper functions for inspecting external database instance
function queryDbAll(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function queryDbGet(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function closeDb(database) {
  return new Promise((resolve) => {
    if (!database) return resolve();
    database.close((err) => {
      resolve(err);
    });
  });
}

// Inspect uploaded database and return its sagras/events
app.post('/api/database/inspect', (req, res) => {
  const tempPath = path.join(appRoot, 'inspect_temp.db');
  const writeStream = fs.createWriteStream(tempPath);
  req.pipe(writeStream);

  writeStream.on('finish', async () => {
    let inspectDb = null;
    try {
      inspectDb = new sqlite3.Database(tempPath);

      // Check if sagras table exists
      const tableCheck = await queryDbGet(inspectDb, "SELECT name FROM sqlite_master WHERE type='table' AND name='sagras'");
      if (!tableCheck) {
        await closeDb(inspectDb);
        if (fs.existsSync(tempPath)) {
          try { fs.unlinkSync(tempPath); } catch (e) {}
        }
        return res.status(400).json({ error: "Il file selezionato non è un database valido per questa applicazione." });
      }

      // Check if base_products table exists in inspectDb
      const baseProdCheck = await queryDbGet(inspectDb, "SELECT name FROM sqlite_master WHERE type='table' AND name='base_products'");
      const hasBaseProducts = !!baseProdCheck;

      const sagrasQuery = `
        SELECT s.id, s.name, s.status, s.created_at,
          (SELECT COUNT(*) FROM categories c WHERE c.sagra_id = s.id) as category_count,
          (SELECT COUNT(*) FROM products p JOIN categories c ON p.category_id = c.id WHERE c.sagra_id = s.id) as product_count,
          (SELECT COUNT(*) FROM orders o WHERE o.sagra_id = s.id) as order_count
          ${hasBaseProducts ? ', (SELECT COUNT(*) FROM base_products bp WHERE bp.sagra_id = s.id) as base_product_count' : ', 0 as base_product_count'}
        FROM sagras s
        ORDER BY s.created_at DESC
      `;

      const sagras = await queryDbAll(inspectDb, sagrasQuery);
      await closeDb(inspectDb);
      res.json({ success: true, sagras });
    } catch (e) {
      console.error("Inspect DB Error:", e);
      if (inspectDb) {
        await closeDb(inspectDb);
      }
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (err) {}
      }
      res.status(500).json({ error: "Errore durante la lettura del database: " + e.message });
    }
  });

  writeStream.on('error', (err) => {
    console.error("Upload Stream Error:", err);
    res.status(500).json({ error: "Caricamento fallito" });
  });
});

// Import selected sagras from inspect_temp.db into active db
app.post('/api/database/import-selected', async (req, res) => {
  const { selectedSagraIds } = req.body;
  if (!Array.isArray(selectedSagraIds) || selectedSagraIds.length === 0) {
    return res.status(400).json({ error: "Nessun evento selezionato per l'importazione." });
  }

  const tempPath = path.join(appRoot, 'inspect_temp.db');
  if (!fs.existsSync(tempPath)) {
    return res.status(400).json({ error: "File database temporaneo non trovato. Ricarica il file." });
  }

  let inspectDb = null;
  try {
    inspectDb = new sqlite3.Database(tempPath);
    const baseProdCheck = await queryDbGet(inspectDb, "SELECT name FROM sqlite_master WHERE type='table' AND name='base_products'");
    const hasBaseProducts = !!baseProdCheck;

    await dbRun("BEGIN TRANSACTION");

    for (const sagraId of selectedSagraIds) {
      const sagra = await queryDbGet(inspectDb, "SELECT * FROM sagras WHERE id = ?", [sagraId]);
      if (!sagra) continue;

      // Insert Sagra into main DB (always active)
      const sagraResult = await dbRun("INSERT INTO sagras (name, status, created_at) VALUES (?, 'active', ?)", [
        sagra.name,
        sagra.created_at || new Date().toISOString()
      ]);
      const newSagraId = sagraResult.lastID;

      // Copy Categories & Products
      const categories = await queryDbAll(inspectDb, "SELECT * FROM categories WHERE sagra_id = ?", [sagraId]);
      for (const cat of categories) {
        const catResult = await dbRun("INSERT INTO categories (name, is_hidden, sagra_id) VALUES (?, ?, ?)", [
          cat.name,
          cat.is_hidden || 0,
          newSagraId
        ]);
        const newCatId = catResult.lastID;

        const products = await queryDbAll(inspectDb, "SELECT * FROM products WHERE category_id = ?", [cat.id]);
        for (const p of products) {
          await dbRun(
            "INSERT INTO products (name, price, quantity, type, is_composite, is_selection, components, category_id, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              p.name,
              p.price || 0,
              (p.quantity !== undefined && p.quantity !== null && p.quantity !== '') ? p.quantity : null,
              p.type || (p.is_composite ? 'composite' : (p.is_selection ? 'selection' : 'simple')),
              p.is_composite || 0,
              p.is_selection || 0,
              p.components || null,
              newCatId,
              p.position || 0
            ]
          );
        }
      }

      // Copy Base Products (if present)
      if (hasBaseProducts) {
        const baseProducts = await queryDbAll(inspectDb, "SELECT * FROM base_products WHERE sagra_id = ?", [sagraId]);
        for (const bp of baseProducts) {
          await dbRun("INSERT INTO base_products (name, quantity, sagra_id) VALUES (?, ?, ?)", [
            bp.name,
            (bp.quantity !== undefined && bp.quantity !== null && bp.quantity !== '') ? bp.quantity : null,
            newSagraId
          ]);
        }
      }

      // Copy Orders & Order Items
      const orders = await queryDbAll(inspectDb, "SELECT * FROM orders WHERE sagra_id = ?", [sagraId]);
      for (const ord of orders) {
        const ordResult = await dbRun("INSERT INTO orders (seq, total, created_at, sagra_id) VALUES (?, ?, ?, ?)", [
          ord.seq || 0,
          ord.total || 0,
          ord.created_at || new Date().toISOString(),
          newSagraId
        ]);
        const newOrderId = ordResult.lastID;

        const orderItems = await queryDbAll(inspectDb, "SELECT * FROM order_items WHERE order_id = ?", [ord.id]);
        for (const item of orderItems) {
          await dbRun("INSERT INTO order_items (order_id, product_name, quantity, price) VALUES (?, ?, ?, ?)", [
            newOrderId,
            item.product_name,
            item.quantity,
            item.price
          ]);
        }
      }
    }

    await dbRun("COMMIT");

    await closeDb(inspectDb);
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (e) {}
    }

    res.json({ success: true, importedCount: selectedSagraIds.length });
  } catch (e) {
    console.error("Import Selected Events Error:", e);
    await dbRun("ROLLBACK").catch(() => {});
    if (inspectDb) {
      await closeDb(inspectDb);
    }
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (e) {}
    }
    res.status(500).json({ error: "Errore durante l'importazione selettiva: " + e.message });
  }
});

// Cancel inspection and clean up temp file
app.post('/api/database/inspect-cancel', (req, res) => {
  const tempPath = path.join(appRoot, 'inspect_temp.db');
  if (fs.existsSync(tempPath)) {
    try { fs.unlinkSync(tempPath); } catch (e) {}
  }
  res.json({ success: true });
});

// RECEIPT CONFIG APIs
app.get('/api/receipt-config', (req, res) => {
  const { getReceiptConfig } = require('./templates/receipt_header');
  res.json(getReceiptConfig());
});

app.put('/api/receipt-config', (req, res) => {
  try {
    const { getReceiptConfigPath } = require('./templates/receipt_header');
    const configPath = getReceiptConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ success: true });
  } catch (e) {
    console.error("Save Receipt Config Error:", e);
    res.status(500).send(e.message);
  }
});

// --- APIs ---

// SAGRAS APIs
app.get('/api/sagras', (req, res) => {
  db.all("SELECT * FROM sagras ORDER BY status ASC, created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/sagras', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).send("Name required");

  db.run("INSERT INTO sagras (name, status) VALUES (?, 'active')", [name], function (err) {
    if (err) return res.status(500).send(err.message);

    // Auto-create Categories per user request
    const sagraId = this.lastID;
    const stmt = db.prepare("INSERT INTO categories (name, sagra_id) VALUES (?, ?)");
    stmt.run("Cibo", sagraId);
    stmt.run("Bevande", sagraId, (err) => {
      stmt.finalize();
      res.json({ id: sagraId, name, status: 'active' });
    });
  });
});

// ARCHIVE Sagra
app.put('/api/sagras/:id/archive', async (req, res) => {
  try {
    await dbRun("UPDATE sagras SET status = 'archived' WHERE id = ?", [req.params.id]);
    res.send("Archived");
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// UNARCHIVE Sagra
app.put('/api/sagras/:id/unarchive', async (req, res) => {
  try {
    await dbRun("UPDATE sagras SET status = 'active' WHERE id = ?", [req.params.id]);
    res.send("Unarchived");
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// RENAME Sagra
app.put('/api/sagras/:id/rename', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).send("Nome richiesto");
  try {
    await dbRun("UPDATE sagras SET name = ? WHERE id = ?", [name.trim(), req.params.id]);
    res.send("Renamed");
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// DELETE Sagra
app.delete('/api/sagras/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await dbRun("BEGIN TRANSACTION");
    await dbRun("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE sagra_id = ?)", [id]);
    await dbRun("DELETE FROM orders WHERE sagra_id = ?", [id]);
    await dbRun("DELETE FROM products WHERE category_id IN (SELECT id FROM categories WHERE sagra_id = ?)", [id]);
    await dbRun("DELETE FROM categories WHERE sagra_id = ?", [id]);
    await dbRun("DELETE FROM sagras WHERE id = ?", [id]);
    await dbRun("COMMIT");
    res.send("Deleted");
  } catch (e) {
    await dbRun("ROLLBACK").catch(() => {});
    console.error(e);
    res.status(500).send(e.message);
  }
});

// DUPLICATE Sagra
app.post('/api/sagras/:id/duplicate', async (req, res) => {
  const sourceId = req.params.id;
  try {
    const sagras = await dbAll("SELECT * FROM sagras WHERE id = ?", [sourceId]);
    if (!sagras || sagras.length === 0) return res.status(404).send("Evento non trovato");

    const sourceSagra = sagras[0];
    const newName = `${sourceSagra.name} (Copia)`;

    await dbRun("BEGIN TRANSACTION");

    const result = await dbRun("INSERT INTO sagras (name, status) VALUES (?, 'active')", [newName]);
    const newSagraId = result.lastID;

    // Duplicate Categories and all Product types (Simple, Base [type='base'], Composite, Selection) & Links
    const categories = await dbAll("SELECT * FROM categories WHERE sagra_id = ?", [sourceId]);
    for (const cat of categories) {
      const catResult = await dbRun("INSERT INTO categories (name, is_hidden, sagra_id) VALUES (?, ?, ?)", [cat.name, cat.is_hidden || 0, newSagraId]);
      const newCatId = catResult.lastID;

      const products = await dbAll("SELECT * FROM products WHERE category_id = ? ORDER BY position ASC, id ASC", [cat.id]);
      for (const prod of products) {
        const pType = prod.type || (prod.is_selection === 1 ? 'selection' : (prod.is_composite === 1 ? 'composite' : 'simple'));
        const isComp = pType === 'composite' ? 1 : 0;
        const isSel = pType === 'selection' ? 1 : 0;
        const compsStr = typeof prod.components === 'string' ? prod.components : (prod.components ? JSON.stringify(prod.components) : null);
        const pos = (prod.position !== undefined && prod.position !== null) ? parseInt(prod.position) : 0;

        await dbRun(
          "INSERT INTO products (name, price, quantity, type, is_composite, is_selection, components, category_id, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [prod.name, prod.price, prod.quantity, pType, isComp, isSel, compsStr, newCatId, pos]
        );
      }
    }

    await dbRun("COMMIT");
    res.json({ id: newSagraId, name: newName, status: 'active' });
  } catch (e) {
    await dbRun("ROLLBACK").catch(() => {});
    console.error("Duplicate Sagra Error:", e);
    res.status(500).send(e.message);
  }
});


// GET Menu for specific Sagra
app.get('/api/sagras/:id/products', async (req, res) => {
  const sagraId = req.params.id;
  const sql = `
      SELECT c.id as category_id, c.name as category, c.is_hidden as category_is_hidden, p.id, p.name, p.price, p.quantity, p.type, p.is_composite, p.is_selection, p.components, p.position
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      WHERE c.sagra_id = ?
      ORDER BY c.id, p.position ASC, p.id ASC
    `;

  try {
    const rows = await dbAll(sql, [sagraId]);
    const grouped = {};
    const meta = {};

    rows.forEach(curr => {
      if (!grouped[curr.category]) {
        grouped[curr.category] = [];
        meta[curr.category] = { is_hidden: curr.category_is_hidden || 0 };
      }
      if (curr.id) {
        let parsedComponents = [];
        if (curr.components) {
          try { parsedComponents = JSON.parse(curr.components); } catch (e) {}
        }
        const pType = curr.type || (curr.is_selection === 1 ? 'selection' : (curr.is_composite === 1 ? 'composite' : 'simple'));
        grouped[curr.category].push({
          ...curr,
          type: pType,
          is_composite: pType === 'composite' ? 1 : 0,
          is_selection: pType === 'selection' ? 1 : 0,
          components: parsedComponents
        });
      }
    });

    res.json({ products: grouped, meta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Product Name Suggestions across all sagras
app.get('/api/products/suggestions', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (query.length < 3) {
    return res.json([]);
  }

  try {
    const sql = `
      SELECT p.name, MAX(p.id) as max_id
      FROM products p
      WHERE LOWER(p.name) LIKE LOWER(?)
      GROUP BY LOWER(p.name)
      ORDER BY max_id DESC
      LIMIT 2
    `;
    const searchPattern = `%${query}%`;
    const rows = await dbAll(sql, [searchPattern]);
    const suggestions = rows.map(r => r.name);
    res.json(suggestions);
  } catch (e) {
    console.error("Error fetching product suggestions:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// UPDATE Menu
app.put('/api/sagras/:id/menu', async (req, res) => {
  const sagraId = req.params.id;
  const { categories } = req.body;
  if (!categories) return res.status(400).send("Invalid data");

  try {
    await dbRun("BEGIN TRANSACTION");
    await dbRun("DELETE FROM products WHERE category_id IN (SELECT id FROM categories WHERE sagra_id = ?)", [sagraId]);
    await dbRun("DELETE FROM categories WHERE sagra_id = ?", [sagraId]);

    for (const cat of categories) {
      const isHidden = cat.is_hidden ? 1 : 0;
      const result = await dbRun("INSERT INTO categories (name, sagra_id, is_hidden) VALUES (?, ?, ?)", [cat.name, sagraId, isHidden]);
      const catId = result.lastID;
      if (cat.products && cat.products.length > 0) {
        let pIdx = 0;
        for (const p of cat.products) {
          const pType = p.type || (p.is_selection ? 'selection' : (p.is_composite ? 'composite' : 'simple'));
          const isComp = pType === 'composite' ? 1 : 0;
          const isSel = pType === 'selection' ? 1 : 0;
          const pPrice = pType === 'base' ? 0 : (parseFloat(p.price) || 0);
          const qty = ((pType === 'simple' || pType === 'base') && p.quantity !== undefined && p.quantity !== null && p.quantity !== '') ? parseInt(p.quantity) : null;
          const compsStr = (pType !== 'simple' && pType !== 'base' && p.components && p.components.length > 0) ? JSON.stringify(p.components) : null;
          const pos = (p.position !== undefined && p.position !== null) ? parseInt(p.position) : pIdx;
          pIdx++;

          await dbRun("INSERT INTO products (name, price, quantity, type, is_composite, is_selection, components, category_id, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [p.name, pPrice, qty, pType, isComp, isSel, compsStr, catId, pos]);
        }
      }
    }
    await dbRun("COMMIT");
    res.send("Menu Updated");
  } catch (err) {
    await dbRun("ROLLBACK");
    console.error("Menu Update Error:", err);
    res.status(500).send(err.message);
  }
});

// Create Order (SEQ LOGIC + THERMAL PRINT + INVENTORY)
app.post('/api/orders', async (req, res) => {
  const { items, total, sagraId, printerName, template, testMode, printEventName, isReprint, orderId: reqOrderId } = req.body;
  if (!items || items.length === 0) return res.status(400).send('Empty order');
  const targetSagra = sagraId || 1;

  try {
    let seq = reqOrderId;

    if (!isReprint) {
      await dbRun("BEGIN TRANSACTION");

      // 1. Inventory Check & Aggregated Update
      const stockDeductions = {};

      // Helper function to resolve sub-component stock deductions recursively
      async function resolveProductStockDeductions(compName, requiredQty, visited = new Set()) {
        if (!compName || visited.has(compName)) return;
        visited.add(compName);

        const compRows = await dbAll(`
          SELECT p.id, p.name, p.quantity, p.is_composite, p.is_selection, p.components 
          FROM products p 
          JOIN categories c ON p.category_id = c.id 
          WHERE c.sagra_id = ? AND p.name = ?
        `, [targetSagra, compName]);

        if (compRows.length > 0) {
          const comp = compRows[0];
          const isNestedComp = comp.is_composite === 1 || comp.is_selection === 1;

          if (isNestedComp) {
            let subComps = [];
            if (comp.components) {
              try { subComps = JSON.parse(comp.components); } catch (e) {}
            }
            if (Array.isArray(subComps) && subComps.length > 0) {
              for (const subName of subComps) {
                await resolveProductStockDeductions(subName, requiredQty, visited);
              }
            }
          } else {
            if (comp.quantity !== null && comp.quantity !== undefined) {
              if (!stockDeductions[comp.id]) {
                stockDeductions[comp.id] = { id: comp.id, name: comp.name, currentQty: comp.quantity, requiredQty: 0 };
              }
              stockDeductions[comp.id].requiredQty += requiredQty;
            }
          }
        }
      }

      for (const item of items) {
        if (item.id) {
          const prodRows = await dbAll("SELECT id, name, quantity, is_composite, is_selection, components FROM products WHERE id = ?", [item.id]);
          if (prodRows.length > 0) {
            const prod = prodRows[0];
            const isComp = prod.is_composite === 1 || prod.is_selection === 1;

            if (isComp) {
              // Composite or Selection product: priority to cashier's selected components
              let comps = [];
              if (Array.isArray(item.components) && item.components.length > 0) {
                comps = item.components;
              } else if (Array.isArray(item.selectedComponents) && item.selectedComponents.length > 0) {
                comps = item.selectedComponents;
              } else if (prod.components) {
                try { comps = JSON.parse(prod.components); } catch (e) {}
              }

              for (const compName of comps) {
                await resolveProductStockDeductions(compName, item.quantity);
              }
            } else {
              // Standard product
              if (prod.quantity !== null) {
                if (!stockDeductions[prod.id]) {
                  stockDeductions[prod.id] = { id: prod.id, name: prod.name, currentQty: prod.quantity, requiredQty: 0 };
                }
                stockDeductions[prod.id].requiredQty += item.quantity;
              }
            }
          }
        }
      }

      // Verify sufficiency
      for (const prodId in stockDeductions) {
        const d = stockDeductions[prodId];
        if (d.currentQty < d.requiredQty) {
          throw new Error(`Scorte insufficienti per il componente: ${d.name} (Rimasti: ${d.currentQty})`);
        }
      }

      // Apply updates
      for (const prodId in stockDeductions) {
        const d = stockDeductions[prodId];
        await dbRun("UPDATE products SET quantity = quantity - ? WHERE id = ?", [d.requiredQty, d.id]);
      }

      // 2. Insert Order
      const isoNow = new Date().toISOString();
      const result = await dbRun("INSERT INTO orders (total, sagra_id, created_at) VALUES (?, ?, ?)", [total, targetSagra, isoNow]);
      const newOrderId = result.lastID;

      // 3. Get Sequence Number
      const row = await dbAll("SELECT COUNT(*) as count FROM orders WHERE sagra_id = ?", [targetSagra]);
      seq = row[0].count;
      await dbRun("UPDATE orders SET seq = ? WHERE id = ?", [seq, newOrderId]);

      // 4. Insert Items
      const stmt = db.prepare("INSERT INTO order_items (order_id, product_name, quantity, price) VALUES (?, ?, ?, ?)");
      for (const item of items) {
        stmt.run(newOrderId, item.name, item.quantity, item.price);
      }
      stmt.finalize();

      await dbRun("COMMIT");
    }

    // 5. Printing / Test Mode Logic (Applies to both New Orders and Reprints)
    try {
      // Fetch event name from DB (only if enabled)
      let sagraName = '';
      if (printEventName !== false) {
        const sagraRows = await dbAll("SELECT name FROM sagras WHERE id = ?", [targetSagra]);
        if (sagraRows.length > 0) sagraName = sagraRows[0].name;
      }

      // Enrich items with category, is_composite & linkedDrinks
      const enrichedItems = [];
      for (const item of items) {
        let itemCopy = { ...item };

        let prodRows = [];
        if (item.id) {
          prodRows = await dbAll(`
            SELECT p.id, p.name, p.is_composite, p.is_selection, p.components, c.name as category_name
            FROM products p
            JOIN categories c ON p.category_id = c.id
            WHERE p.id = ?
          `, [item.id]);
        }
        if (prodRows.length === 0 && item.name) {
          prodRows = await dbAll(`
            SELECT p.id, p.name, p.is_composite, p.is_selection, p.components, c.name as category_name
            FROM products p
            JOIN categories c ON p.category_id = c.id
            WHERE c.sagra_id = ? AND p.name = ?
          `, [targetSagra, item.name]);
        }

        if (prodRows.length > 0) {
          const prod = prodRows[0];
          const pType = prod.type || (prod.is_selection === 1 ? 'selection' : (prod.is_composite === 1 ? 'composite' : 'simple'));
          itemCopy.category = itemCopy.category || prod.category_name;
          itemCopy.type = pType;
          itemCopy.is_composite = pType === 'composite' ? 1 : 0;
          itemCopy.is_selection = pType === 'selection' ? 1 : 0;

          let comps = [];
          if (Array.isArray(item.components) && item.components.length > 0) {
            comps = item.components;
          } else if (Array.isArray(item.selectedComponents) && item.selectedComponents.length > 0) {
            comps = item.selectedComponents;
          } else if (prod.components) {
            try { comps = JSON.parse(prod.components); } catch (e) {}
          }
          if (Array.isArray(comps) && comps.length > 0) {
            const drinkComps = [];
            const foodComps = [];
            for (const compName of comps) {
              const compRows = await dbAll(`
                SELECT p.name, p.type, c.name as category_name
                FROM products p
                JOIN categories c ON p.category_id = c.id
                WHERE c.sagra_id = ? AND p.name = ?
              `, [targetSagra, compName]);

              if (compRows.length > 0) {
                const comp = compRows[0];
                // Base products (type === 'base' or category === 'Prodotti Base') MUST NOT be printed on receipts
                if (comp.type === 'base' || comp.category_name === 'Prodotti Base') {
                  continue;
                }
                if (comp.category_name && comp.category_name.toLowerCase() === 'bevande') {
                  drinkComps.push(compName);
                } else if (prod.is_selection === 1) {
                  foodComps.push(compName);
                }
              }
            }
            itemCopy.linkedDrinks = drinkComps;
            if (prod.is_selection === 1) {
              itemCopy.foodComponents = foodComps;
            }
          }
        }

        enrichedItems.push(itemCopy);
      }

      const receiptData = {
        seq: seq,
        items: enrichedItems,
        total: total,
        sagraName: sagraName,
        date: new Date().toLocaleString('it-IT')
      };

      let printResult = null;
      if (template === 'split') {
        printResult = await generateSplitReceipt(receiptData);
      } else {
        printResult = await generateCompactReceipt(receiptData);
      }

      if (testMode) {
        console.log(`[TEST MODE] ${isReprint ? 'Reprint' : 'New Order'} #${seq}.`);
        return res.json({ success: true, orderId: seq, testMode: true, preview: printResult.preview });
      }

      if (printerName) {
        const targetPrinter = printerName || "POS-80";
        console.log(`Printing ${isReprint ? 'Reprint' : 'New Order'} #${seq} to "${targetPrinter}"...`);
        await printRawBuffer(printResult.buffer, targetPrinter);
      }

      res.json({ success: true, orderId: seq, preview: printResult.preview });

    } catch (printErr) {
      console.error("Printing Error:", printErr);
      res.json({ success: true, orderId: seq, warning: "Errore stampa: " + printErr.message });
      return;
    }

  } catch (err) {
    if (!isReprint) await dbRun("ROLLBACK").catch(() => {});
    console.error("Order Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get History
app.get('/api/history', (req, res) => {
  const sagraId = req.query.sagraId || 1;
  const sql = `
    SELECT 
      o.id as order_id,
      o.seq as order_seq,
      o.total, 
      o.created_at,
      oi.product_name,
      oi.quantity,
      oi.price as item_price
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.sagra_id = ?
    ORDER BY o.created_at DESC
    LIMIT 200
  `;

  db.all(sql, [sagraId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const orders = {};
    rows.forEach(row => {
      if (!orders[row.order_id]) {
        orders[row.order_id] = {
          id: row.order_id,
          seq: row.order_seq || row.order_id, // Fallback
          total: row.total,
          created_at: row.created_at,
          items: []
        };
      }
      if (row.product_name) {
        orders[row.order_id].items.push({
          name: row.product_name,
          quantity: row.quantity,
          price: row.item_price
        });
      }
    });
    res.json(Object.values(orders));
  });
});

// STATS API
app.get('/api/stats', async (req, res) => {
  const sagraId = req.query.sagraId || 1;
  const { start_date, end_date } = req.query;

  let dateFilter = "";
  const params = [sagraId];

  if (start_date && end_date) {
    dateFilter = "AND DATE(datetime(created_at, 'localtime')) BETWEEN ? AND ?";
    params.push(start_date, end_date);
  } else if (start_date) {
    dateFilter = "AND DATE(datetime(created_at, 'localtime')) >= ?";
    params.push(start_date);
  } else if (end_date) {
    dateFilter = "AND DATE(datetime(created_at, 'localtime')) <= ?";
    params.push(end_date);
  }

  try {
    const totalRow = await new Promise((resolve, reject) => {
      db.get(`SELECT COUNT(*) as count, SUM(total) as revenue FROM orders WHERE sagra_id = ? ${dateFilter}`, params, (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });

    const topItems = await new Promise((resolve, reject) => {
      db.all(`
            SELECT product_name, SUM(quantity) as qty, SUM(price * quantity) as revenue 
            FROM order_items 
            WHERE order_id IN (SELECT id FROM orders WHERE sagra_id = ? ${dateFilter})
            GROUP BY product_name 
            ORDER BY qty DESC
        `, params, (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });

    const hourlySales = await new Promise((resolve, reject) => {
      db.all(`
            SELECT 
              strftime('%H:00', datetime(created_at, 'localtime')) as hour_slot, 
              COUNT(id) as orders_count, 
              SUM(total) as revenue,
              MIN(created_at) as min_time
            FROM orders 
            WHERE sagra_id = ? ${dateFilter}
            GROUP BY strftime('%Y-%m-%d %H:00', datetime(created_at, 'localtime')) 
            ORDER BY min_time ASC
        `, params, (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });

    res.json({
      ordersCount: totalRow.count || 0,
      totalRevenue: totalRow.revenue || 0,
      topItems: topItems || [],
      hourlySales: hourlySales || []
    });

  } catch (e) {
    res.status(500).send(e.message);
  }
});

// GLOBAL REPORTS API - OVERVIEW
app.get('/api/reports/overview', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let orderWhereClause = "";
    const orderParams = [];

    if (start_date && end_date) {
      orderWhereClause = "WHERE DATE(datetime(created_at, 'localtime')) BETWEEN ? AND ?";
      orderParams.push(start_date, end_date);
    } else if (start_date) {
      orderWhereClause = "WHERE DATE(datetime(created_at, 'localtime')) >= ?";
      orderParams.push(start_date);
    } else if (end_date) {
      orderWhereClause = "WHERE DATE(datetime(created_at, 'localtime')) <= ?";
      orderParams.push(end_date);
    }

    // 1. Global totals across filtered orders
    const totalsRow = await new Promise((resolve, reject) => {
      db.get(`SELECT COUNT(id) as totalOrders, COALESCE(SUM(total), 0) as totalRevenue FROM orders ${orderWhereClause}`, orderParams, (err, row) => {
        if (err) reject(err); else resolve(row || { totalOrders: 0, totalRevenue: 0 });
      });
    });

    const totalOrders = totalsRow.totalOrders || 0;
    const totalRevenue = totalsRow.totalRevenue || 0;
    const averageOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

    // 2. Sagras breakdown
    let sagraOrderJoin = "";
    let sagraOrderParams = [];
    if (start_date && end_date) {
      sagraOrderJoin = `LEFT JOIN orders o ON o.sagra_id = s.id AND DATE(datetime(o.created_at, 'localtime')) BETWEEN ? AND ?`;
      sagraOrderParams = [start_date, end_date];
    } else if (start_date) {
      sagraOrderJoin = `LEFT JOIN orders o ON o.sagra_id = s.id AND DATE(datetime(o.created_at, 'localtime')) >= ?`;
      sagraOrderParams = [start_date];
    } else if (end_date) {
      sagraOrderJoin = `LEFT JOIN orders o ON o.sagra_id = s.id AND DATE(datetime(o.created_at, 'localtime')) <= ?`;
      sagraOrderParams = [end_date];
    } else {
      sagraOrderJoin = `LEFT JOIN orders o ON o.sagra_id = s.id`;
    }

    const sagrasList = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          s.id, 
          s.name, 
          s.status, 
          s.created_at,
          COUNT(o.id) as orders_count,
          COALESCE(SUM(o.total), 0) as revenue
        FROM sagras s
        ${sagraOrderJoin}
        GROUP BY s.id
        ORDER BY revenue DESC, s.id DESC
      `, sagraOrderParams, (err, rows) => {
        if (err) reject(err); else resolve(rows || []);
      });
    });

    // 3. Top products sold across filtered orders
    let topProdWhere = "WHERE (c.name IS NULL OR c.name != 'Prodotti Base')";
    let topProdParams = [];
    if (start_date && end_date) {
      topProdWhere += " AND DATE(datetime(o.created_at, 'localtime')) BETWEEN ? AND ?";
      topProdParams.push(start_date, end_date);
    } else if (start_date) {
      topProdWhere += " AND DATE(datetime(o.created_at, 'localtime')) >= ?";
      topProdParams.push(start_date);
    } else if (end_date) {
      topProdWhere += " AND DATE(datetime(o.created_at, 'localtime')) <= ?";
      topProdParams.push(end_date);
    }

    const topProducts = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          oi.product_name,
          COALESCE(c.name, 'Altro') as category_name,
          SUM(oi.quantity) as total_qty,
          SUM(oi.price * oi.quantity) as total_revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN (
          SELECT p.name, p.category_id, cat.sagra_id 
          FROM products p 
          JOIN categories cat ON p.category_id = cat.id
          GROUP BY p.name, cat.sagra_id
        ) p ON p.name = oi.product_name AND p.sagra_id = o.sagra_id
        LEFT JOIN categories c ON p.category_id = c.id
        ${topProdWhere}
        GROUP BY oi.product_name
        ORDER BY total_qty DESC
        LIMIT 15
      `, topProdParams, (err, rows) => {
        if (err) reject(err); else resolve(rows || []);
      });
    });

    // 4. Category revenue breakdown
    let catWhere = "WHERE (c.name IS NULL OR c.name != 'Prodotti Base')";
    let catParams = [];
    if (start_date && end_date) {
      catWhere += " AND DATE(datetime(o.created_at, 'localtime')) BETWEEN ? AND ?";
      catParams.push(start_date, end_date);
    } else if (start_date) {
      catWhere += " AND DATE(datetime(o.created_at, 'localtime')) >= ?";
      catParams.push(start_date);
    } else if (end_date) {
      catWhere += " AND DATE(datetime(o.created_at, 'localtime')) <= ?";
      catParams.push(end_date);
    }

    const categoryBreakdown = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          COALESCE(c.name, 'Generale') as category_name,
          SUM(oi.quantity) as total_qty,
          SUM(oi.price * oi.quantity) as total_revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN (
          SELECT p.name, p.category_id, cat.sagra_id 
          FROM products p 
          JOIN categories cat ON p.category_id = cat.id
          GROUP BY p.name, cat.sagra_id
        ) p ON p.name = oi.product_name AND p.sagra_id = o.sagra_id
        LEFT JOIN categories c ON p.category_id = c.id
        ${catWhere}
        GROUP BY COALESCE(c.name, 'Generale')
        ORDER BY total_revenue DESC
      `, catParams, (err, rows) => {
        if (err) reject(err); else resolve(rows || []);
      });
    });

    // 5. Sales timelines: By Day, By Week, By Month
    let timelineWhere = orderWhereClause ? `${orderWhereClause}` : "";
    let timelineParams = [...orderParams];

    const timelineDay = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          strftime('%Y-%m-%d', datetime(created_at, 'localtime')) as time_key,
          strftime('%d/%m/%Y', datetime(created_at, 'localtime')) as label,
          strftime('%d/%m', datetime(created_at, 'localtime')) as short_label,
          COUNT(id) as orders_count,
          SUM(total) as revenue
        FROM orders
        ${timelineWhere}
        GROUP BY time_key
        ORDER BY time_key ASC
      `, timelineParams, (err, rows) => {
        if (err) reject(err); else resolve(rows || []);
      });
    });

    const timelineWeek = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          strftime('%Y-W%W', datetime(created_at, 'localtime')) as time_key,
          'Sett. ' || strftime('%W', datetime(created_at, 'localtime')) || ' (' || strftime('%Y', datetime(created_at, 'localtime')) || ')' as label,
          'Sett. ' || strftime('%W', datetime(created_at, 'localtime')) as short_label,
          COUNT(id) as orders_count,
          SUM(total) as revenue
        FROM orders
        ${timelineWhere}
        GROUP BY time_key
        ORDER BY time_key ASC
      `, timelineParams, (err, rows) => {
        if (err) reject(err); else resolve(rows || []);
      });
    });

    const timelineMonth = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          strftime('%Y-%m', datetime(created_at, 'localtime')) as time_key,
          strftime('%m/%Y', datetime(created_at, 'localtime')) as label,
          strftime('%m/%Y', datetime(created_at, 'localtime')) as short_label,
          COUNT(id) as orders_count,
          SUM(total) as revenue
        FROM orders
        ${timelineWhere}
        GROUP BY time_key
        ORDER BY time_key ASC
      `, timelineParams, (err, rows) => {
        if (err) reject(err); else resolve(rows || []);
      });
    });

    res.json({
      success: true,
      filter: {
        start_date: start_date || null,
        end_date: end_date || null
      },
      totals: {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        totalSagras: sagrasList.filter(s => (s.orders_count > 0 || s.revenue > 0)).length || sagrasList.length,
        activeSagras: sagrasList.filter(s => s.status === 'active').length,
        bestSeller: topProducts.length > 0 ? topProducts[0] : null
      },
      sagras: sagrasList,
      topProducts,
      categoryBreakdown,
      timeline: {
        day: timelineDay,
        week: timelineWeek,
        month: timelineMonth
      }
    });
  } catch (err) {
    console.error("Reports overview error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// LIST PRINTERS API
app.get('/api/printers', (req, res) => {
  const cmd = `powershell "Get-Printer | Select-Object Name | ConvertTo-Json"`;
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error("Printer List Error:", err);
      return res.status(500).json({ error: "Failed to list printers" });
    }
    try {
      let printers = JSON.parse(stdout);
      // Handle single result (object) vs multiple (array)
      if (!Array.isArray(printers)) {
        printers = [printers];
      }
      // Extract just the names
      const printerNames = printers.map(p => p.Name);
      res.json(printerNames);
    } catch (e) {
      console.error("Printer Parse Error:", e, stdout);
      res.json([]); // Return empty if parsing fails (e.g. no printers)
    }
  });
});

function checkPrinterConnected(printerName) {
  return new Promise((resolve) => {
    const cmd = `powershell "Get-CimInstance Win32_Printer | Select-Object Name, PrinterStatus, ExtendedPrinterStatus, PrinterState, WorkOffline, PortName | ConvertTo-Json"`;

    exec(cmd, (err, stdout, stderr) => {
      if (err || !stdout || !stdout.trim()) {
        return resolve({
          isConnected: false,
          error: `Impossibile interrogare le stampanti nel sistema.`
        });
      }

      try {
        let printers = JSON.parse(stdout);
        if (!Array.isArray(printers)) printers = [printers];

        const targetName = (printerName || '').toLowerCase();
        const info = printers.find(p => p && p.Name && p.Name.toLowerCase() === targetName);

        if (!info) {
          return resolve({
            isConnected: false,
            error: `Stampante "${printerName}" non trovata o disinstallata nel sistema.`
          });
        }

        // Check if printer is set to WorkOffline or PrinterStatus is Offline / Error
        if (info.WorkOffline === true) {
          return resolve({
            isConnected: false,
            status: 'offline',
            error: `La stampante "${printerName}" risulta scollegata o spenta.`
          });
        }

        // PrinterStatus: 3 = Idle/Ready, 4 = Printing. Status 2, 1, 7 indicate Offline/Unknown/Error
        if (info.PrinterStatus === 2 || info.PrinterStatus === 1 || info.PrinterStatus === 7) {
          return resolve({
            isConnected: false,
            status: 'offline',
            error: `La stampante "${printerName}" risulta scollegata o spenta.`
          });
        }

        resolve({
          isConnected: true,
          status: 'online',
          portName: info.PortName || 'USB'
        });
      } catch (e) {
        console.error("Printer Status CIM Parse Error:", e);
        resolve({ isConnected: false, error: 'Errore durante la verifica dello stato della stampante.' });
      }
    });
  });
}

// TEST PRINTER API
app.post('/api/print-test', async (req, res) => {
  const { printerName } = req.body;
  if (!printerName) {
    return res.status(400).json({ error: "Nessuna stampante selezionata" });
  }

  // 1. Verify printer connectivity before printing
  const statusCheck = await checkPrinterConnected(printerName);
  if (!statusCheck.isConnected) {
    return res.status(400).json({ error: statusCheck.error });
  }

  try {
    const testData = {
      sagraName: "STAMPA DI PROVA",
      items: [{ name: "Test Connessione OK", price: 0.00, quantity: 1 }],
      total: 0.00,
      seq: "TEST"
    };

    const printResult = await generateCompactReceipt(testData);
    console.log(`Sending test print to "${printerName}"...`);
    await printRawBuffer(printResult.buffer, printerName);

    res.json({ success: true, portName: statusCheck.portName });
  } catch (err) {
    console.error("Test Print Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Export CSV
app.get('/api/export', (req, res) => {
  const sagraId = req.query.sagraId || 1;
  const sql = `
    SELECT 
      o.created_at as Data,
      o.seq as OrdineNum,
      o.id as OrdineID,
      oi.product_name as Prodotto,
      oi.quantity as Qta,
      oi.price as PrezzoUnitario,
      (oi.quantity * oi.price) as TotaleRiga
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.sagra_id = ?
    ORDER BY o.created_at DESC
  `;

  db.all(sql, [sagraId], (err, rows) => {
    if (err) return res.status(500).send("DB Error");
    let csv = "Data,Numero,Prodotto,Qta,PrezzoUnitario,TotaleRiga\n";
    rows.forEach(row => {
      csv += `"${row.Data}",${row.OrdineNum || row.OrdineID},"${row.Prodotto}",${row.Qta},${row.PrezzoUnitario},${row.TotaleRiga}\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=evento_${sagraId}_export.csv`);
    res.send(csv);
  });
});

// GET Current Version Changelog / Whats New Notes
app.get('/api/current-changelog', async (req, res) => {
  const pkg = require('./package.json');
  const currentVersion = pkg.version;
  const owner = req.query.owner || 'Tremonzz';
  const repo = req.query.repo || 'Cassa-ProLoco';

  try {
    const { execSync } = require('child_process');
    const tagHtml = execSync(`curl.exe -s -L -H "User-Agent: Mozilla/5.0" "https://github.com/${owner}/${repo}/releases/tag/v${currentVersion}"`, { encoding: 'utf8', windowsHide: true, timeout: 6000 });
    const notesMatch = tagHtml.match(/class="markdown-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || tagHtml.match(/data-test-selector="body-content"[^>]*>([\s\S]*?)<\/div>/i);
    let cleanNotes = "";
    if (notesMatch) {
      cleanNotes = notesMatch[1]
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n### $1\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
    }

    if (!cleanNotes) {
      return res.json({
        version: currentVersion,
        notes: null
      });
    }

    res.json({
      version: currentVersion,
      notes: cleanNotes
    });
  } catch (e) {
    res.json({
      version: currentVersion,
      notes: null
    });
  }
});

// GET Dynamic App Version from package.json
app.get('/api/version', (req, res) => {
  const pkg = require('./package.json');
  res.json({ version: pkg.version });
});

// CHECK UPDATE API (GitHub Public Releases)
let updateCache = { data: null, timestamp: 0 };

app.get('/api/check-update', (req, res) => {
  const owner = req.query.owner || 'Tremonzz';
  const repo = req.query.repo || 'Cassa-ProLoco';
  const pkg = require('./package.json');

  // Check cache first (5 minutes TTL)
  if (updateCache.data && (Date.now() - updateCache.timestamp < 5 * 60 * 1000)) {
    return res.json(updateCache.data);
  }

  const semverCompare = (v1, v2) => {
    const p1 = (v1 || '').split('.').map(Number);
    const p2 = (v2 || '').split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const num1 = p1[i] || 0;
      const num2 = p2[i] || 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  };

  const tryWebFallback = () => {
    try {
      const { execSync } = require('child_process');
      const releasesHtml = execSync(`curl.exe -s -L -H "User-Agent: Mozilla/5.0" "https://github.com/${owner}/${repo}/releases"`, { encoding: 'utf8', windowsHide: true, timeout: 10000 });

      const tagRegex = /\/releases\/tag\/v?([0-9\.]+)/g;
      let tagsFound = [];
      let match;
      while ((match = tagRegex.exec(releasesHtml)) !== null) {
        if (!tagsFound.includes(match[1])) {
          tagsFound.push(match[1]);
        }
      }

      const newerTags = tagsFound.filter(tag => semverCompare(tag, pkg.version) > 0);

      if (newerTags.length > 0) {
        const latestTag = newerTags[0];
        let downloadUrl = `https://github.com/${owner}/${repo}/releases/download/v${latestTag}/Gestione.Ordini.Setup.${latestTag}.exe`;
        let fileSize = 0;

        try {
          const assetsHtml = execSync(`curl.exe -s -L -H "User-Agent: Mozilla/5.0" "https://github.com/${owner}/${repo}/releases/expanded_assets/v${latestTag}"`, { encoding: 'utf8', windowsHide: true, timeout: 8000 });
          const exeMatch = assetsHtml.match(/href="(\/[^"]+\.exe)"/i);
          if (exeMatch) {
            downloadUrl = `https://github.com${exeMatch[1]}`;
          }
          const sizeMatch = assetsHtml.match(/(\d+(?:\.\d+)?)\s*(MB|KB|GB)/i);
          if (sizeMatch) {
            const num = parseFloat(sizeMatch[1]);
            const unit = sizeMatch[2].toUpperCase();
            if (unit === 'MB') fileSize = Math.round(num * 1024 * 1024);
            else if (unit === 'GB') fileSize = Math.round(num * 1024 * 1024 * 1024);
            else if (unit === 'KB') fileSize = Math.round(num * 1024);
          }
        } catch(e){}

        let notesArray = [];
        newerTags.forEach(tag => {
          try {
            const tagHtml = execSync(`curl.exe -s -L -H "User-Agent: Mozilla/5.0" "https://github.com/${owner}/${repo}/releases/tag/v${tag}"`, { encoding: 'utf8', windowsHide: true, timeout: 6000 });
            const notesMatch = tagHtml.match(/class="markdown-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || tagHtml.match(/data-test-selector="body-content"[^>]*>([\s\S]*?)<\/div>/i);
            if (notesMatch) {
              const cleanNotes = notesMatch[1]
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n### $1\n')
                .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/\n\s*\n\s*\n/g, '\n\n')
                .trim();

              notesArray.push(`# Versione v${tag}\n${cleanNotes}`);
            } else {
              notesArray.push(`# Versione v${tag}`);
            }
          } catch(e) {
            notesArray.push(`# Versione v${tag}`);
          }
        });

        const result = {
          hasUpdate: true,
          currentVersion: pkg.version,
          latestVersion: latestTag,
          releaseNotes: notesArray.join('\n\n---\n\n'),
          downloadUrl,
          fileSize,
          releaseUrl: `https://github.com/${owner}/${repo}/releases/tag/v${latestTag}`
        };
        updateCache = { data: result, timestamp: Date.now() };
        return res.json(result);
      }
    } catch(e){}
    return res.json({ hasUpdate: false, currentVersion: pkg.version, status: 'no_release', message: 'Nessuna release trovata' });
  };

  const url = `https://api.github.com/repos/${owner}/${repo}/releases`;
  const options = {
    headers: { 'User-Agent': 'SagraManager-App' },
    rejectUnauthorized: false
  };

  https.get(url, options, (apiRes) => {
    let body = '';
    apiRes.on('data', chunk => body += chunk);
    apiRes.on('end', () => {
      try {
        if (apiRes.statusCode !== 200) {
          return tryWebFallback();
        }

        const releases = JSON.parse(body);
        if (!Array.isArray(releases)) {
          return tryWebFallback();
        }

        const newerReleases = releases.filter(r => {
          const tag = (r.tag_name || '').replace(/^v/, '');
          return semverCompare(tag, pkg.version) > 0;
        });

        if (newerReleases.length === 0) {
          const result = { hasUpdate: false, currentVersion: pkg.version };
          updateCache = { data: result, timestamp: Date.now() };
          return res.json(result);
        }

        newerReleases.sort((a, b) => {
          const tagA = (a.tag_name || '').replace(/^v/, '');
          const tagB = (b.tag_name || '').replace(/^v/, '');
          return semverCompare(tagB, tagA);
        });

        const latestRelease = newerReleases[0];
        const latestTag = (latestRelease.tag_name || '').replace(/^v/, '');

        let exeAsset = (latestRelease.assets || []).find(a => a.name && a.name.endsWith('.exe'));
        let downloadUrl = exeAsset ? exeAsset.browser_download_url : null;
        let fileSize = exeAsset ? exeAsset.size : 0;

        const notesArray = newerReleases.map(r => {
          const tag = (r.tag_name || '').replace(/^v/, '');
          const notes = (r.body || '').trim();
          return `# Versione v${tag}\n${notes || 'Nessuna nota fornita per questa versione.'}`;
        });

        const result = {
          hasUpdate: true,
          currentVersion: pkg.version,
          latestVersion: latestTag,
          releaseNotes: notesArray.join('\n\n---\n\n'),
          downloadUrl,
          fileSize,
          releaseUrl: latestRelease.html_url
        };

        updateCache = { data: result, timestamp: Date.now() };
        res.json(result);

      } catch (e) {
        tryWebFallback();
      }
    });
  }).on('error', () => {
    tryWebFallback();
  });
});
// CLEANUP OLD TEMP UPDATE FILES
function cleanupOldUpdateFiles(currentFileToKeep = null) {
  try {
    const tempDir = os.tmpdir();
    if (!fs.existsSync(tempDir)) return;
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    files.forEach(f => {
      if (f.startsWith('GestioneOrdini_Update_') && (f.endsWith('.exe') || f.endsWith('.progress.json'))) {
        const fullPath = path.join(tempDir, f);
        if (currentFileToKeep && path.resolve(fullPath) === path.resolve(currentFileToKeep)) {
          return;
        }
        try {
          const stat = fs.statSync(fullPath);
          // Delete files older than 2 minutes
          if (now - stat.mtimeMs > 2 * 60 * 1000) {
            fs.unlinkSync(fullPath);
            console.log(`[CLEANUP] Deleted old update temp file: ${f}`);
          }
        } catch (err) {}
      }
    });
  } catch (err) {
    console.warn("[CLEANUP] Error during temp update files cleanup:", err.message);
  }
}

// Clean old temporary installers on server start
cleanupOldUpdateFiles();

// DOWNLOAD & AUTO-INSTALL UPDATE API
let updateProgress = { status: 'idle', percent: 0, downloadedMb: '0.0', totalMb: '0.0', error: null };
let activeProcess = null;
let activeDownloadPath = null;

app.get('/api/update-progress', (req, res) => {
  res.json(updateProgress);
});

app.post('/api/cancel-update', (req, res) => {
  if (activeProcess) {
    try { activeProcess.kill('SIGKILL'); } catch(e){}
    activeProcess = null;
  }
  if (activeDownloadPath) {
    try { if (fs.existsSync(activeDownloadPath)) fs.unlinkSync(activeDownloadPath); } catch(e){}
    activeDownloadPath = null;
  }
  updateProgress = { status: 'idle', percent: 0, downloadedMb: '0.0', totalMb: '0.0', error: null };
  cleanupOldUpdateFiles();
  res.json({ success: true, message: 'Download annullato' });
});

app.post('/api/download-and-install', (req, res) => {
  const { downloadUrl, totalBytes } = req.body;
  if (!downloadUrl) return res.status(400).json({ error: 'URL di download non fornito' });

  if (!downloadUrl.endsWith('.exe')) {
    return res.json({ success: false, redirectUrl: downloadUrl, message: 'Reindirizzamento alla pagina di release' });
  }

  cleanupOldUpdateFiles();

  let totalBytesKnown = parseInt(totalBytes, 10) || 0;

  // Fallback: fast HEAD request to get Content-Length if not passed in body
  if (!totalBytesKnown) {
    try {
      const { execSync } = require('child_process');
      const headerOutput = execSync(`curl.exe -sI -L "${downloadUrl}"`, { encoding: 'utf8', windowsHide: true, timeout: 5000 });
      const match = headerOutput.match(/content-length:\s*(\d+)/i);
      if (match) totalBytesKnown = parseInt(match[1], 10);
    } catch(e){}
  }

  const tempDir = os.tmpdir();
  const destPath = path.join(tempDir, `GestioneOrdini_Update_${Date.now()}.exe`);
  const progressPath = destPath + '.progress.json';

  const initialTotalMb = totalBytesKnown > 0 ? (totalBytesKnown / (1024 * 1024)).toFixed(1) : '?';
  updateProgress = { status: 'downloading', percent: 0, downloadedMb: '0.0', totalMb: initialTotalMb, error: null };
  activeDownloadPath = destPath;

  const { spawn } = require('child_process');

  // PowerShell script: downloads with WebClient
  const escapedUrl = downloadUrl.replace(/'/g, "''");
  const escapedDest = destPath.replace(/\\/g, '\\\\').replace(/'/g, "''");
  const escapedProgress = progressPath.replace(/\\/g, '\\\\').replace(/'/g, "''");

  const psScript = [
    `$url = '${escapedUrl}'`,
    `$dest = '${escapedDest}'`,
    `$progressFile = '${escapedProgress}'`,
    `$wc = New-Object System.Net.WebClient`,
    `$wc.Headers.Add('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')`,
    `$wc.Headers.Add('Accept', '*/*')`,
    `try {`,
    `  $wc.DownloadFile($url, $dest)`,
    `  Set-Content -Path $progressFile -Value '{"status":"done"}' -Encoding UTF8`,
    `} catch {`,
    `  Set-Content -Path $progressFile -Value (ConvertTo-Json @{status='error';message=$_.Exception.Message}) -Encoding UTF8`,
    `}`
  ].join('; ');

  const psProc = spawn('powershell.exe', [
    '-NonInteractive', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript
  ], { windowsHide: true, stdio: 'ignore' });

  activeProcess = psProc;

  // Poll file size on disk every 200ms to update progress
  const progressTimer = setInterval(() => {
    try {
      if (fs.existsSync(destPath)) {
        const stat = fs.statSync(destPath);
        const downloadedBytes = stat.size;
        const percent = totalBytesKnown > 0 ? Math.min(99, Math.round((downloadedBytes / totalBytesKnown) * 100)) : 0;
        const downloadedMb = (downloadedBytes / (1024 * 1024)).toFixed(1);
        const totalMb = totalBytesKnown > 0 ? (totalBytesKnown / (1024 * 1024)).toFixed(1) : '?';
        updateProgress = { status: 'downloading', percent, downloadedMb, totalMb, error: null };
      }
    } catch(e){}
  }, 200);

  psProc.on('close', (code) => {
    clearInterval(progressTimer);
    activeProcess = null;
    try { if (fs.existsSync(progressPath)) fs.unlinkSync(progressPath); } catch(e){}

    if (updateProgress.status === 'idle') return; // Cancelled by user

    const MIN_VALID_SIZE = 100 * 1024; // 100KB minimum for a real installer

    if (code === 0 && fs.existsSync(destPath) && fs.statSync(destPath).size >= MIN_VALID_SIZE) {
      const finalBytes = fs.statSync(destPath).size;
      const finalMb = (finalBytes / (1024 * 1024)).toFixed(1);
      updateProgress = { status: 'completed', percent: 100, downloadedMb: finalMb, totalMb: finalMb, error: null };

      if (!res.headersSent) res.json({ success: true, message: 'Download completato. Avvio installatore...' });

      // Launch downloaded installer directly & gracefully close application
      setTimeout(() => {
        try {
          const child = spawn(destPath, [], {
            detached: true,
            stdio: 'ignore'
          });
          child.unref();

          setTimeout(() => {
            try {
              const { app: electronApp } = require('electron');
              if (electronApp) electronApp.quit(); else process.exit(0);
            } catch(e) { process.exit(0); }
          }, 600);
        } catch(e) {
          console.error("Errore avvio installer:", e);
          try {
            const { app: electronApp } = require('electron');
            if (electronApp) electronApp.quit(); else process.exit(0);
          } catch(e) { process.exit(0); }
        }
      }, 500);;

    } else {
      // Read size BEFORE deleting
      let fileSize = 0;
      try { if (fs.existsSync(destPath)) fileSize = fs.statSync(destPath).size; } catch(e){}
      try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch(e){}
      let errMsg;
      if (code === 0 && fileSize < MIN_VALID_SIZE) {
        // PS exited OK but file is empty or tiny = 404 or redirect to error page
        errMsg = 'File di aggiornamento non trovato su GitHub (404). L\'asset potrebbe non essere ancora stato pubblicato.';
      } else {
        errMsg = updateProgress.error || `Download fallito (codice: ${code})`;
      }
      updateProgress = { status: 'error', percent: 0, downloadedMb: '0.0', totalMb: '0.0', error: errMsg };
      if (!res.headersSent) res.status(500).json({ error: errMsg });
    }
  });

  psProc.on('error', (err) => {
    clearInterval(progressTimer);
    activeProcess = null;
    try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch(e){}
    try { if (fs.existsSync(progressPath)) fs.unlinkSync(progressPath); } catch(e){}
    if (updateProgress.status !== 'idle') {
      updateProgress = { status: 'error', percent: 0, downloadedMb: '0.0', totalMb: '0.0', error: err.message };
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  });
});

let portInUse = false;
let serverInstance = null;

try {
  serverInstance = app.listen(port, () => {
    console.log(`Evento App listening at http://localhost:${port}`);
  });

  serverInstance.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      portInUse = true;
      console.warn(`[WARN] Port ${port} is already in use by another instance.`);
    } else {
      console.error("Server listen error:", err);
    }
  });
} catch (err) {
  portInUse = true;
  console.warn(`[WARN] Server listen error:`, err.message);
}

module.exports = {
  app,
  serverInstance,
  isPortInUse: () => portInUse
};
