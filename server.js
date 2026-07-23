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
app.get('/receipt_header_resized.png', (req, res) => {
  const resizedPath = path.join(os.tmpdir(), 'receipt_header_resized.png');
  if (fs.existsSync(resizedPath)) {
    return res.sendFile(resizedPath);
  }
  const originalPath = path.join(__dirname, 'public', 'images', 'receipt_header.png');
  if (fs.existsSync(originalPath)) {
    return res.sendFile(originalPath);
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

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function (err, rows) {
      if (err) reject(err);
      else resolve(rows);
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
        category_id INTEGER,
        FOREIGN KEY(category_id) REFERENCES categories(id)
      )
    `, (err) => {
      // Migration for existing tables
      db.run("ALTER TABLE products ADD COLUMN quantity INTEGER DEFAULT NULL", (e) => {
        if (!e) console.log("Migration: Added 'quantity' column to products.");
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
  res.download(dbPath, 'sagra_backup.db', (err) => {
    if (err) {
      console.error("Export Error:", err);
      // res.status(500).send("Error exporting database"); // Can't send after download starts usually
    }
  });
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

    const categories = await dbAll("SELECT * FROM categories WHERE sagra_id = ?", [sourceId]);
    for (const cat of categories) {
      const catResult = await dbRun("INSERT INTO categories (name, is_hidden, sagra_id) VALUES (?, ?, ?)", [cat.name, cat.is_hidden, newSagraId]);
      const newCatId = catResult.lastID;

      const products = await dbAll("SELECT * FROM products WHERE category_id = ?", [cat.id]);
      for (const prod of products) {
        await dbRun("INSERT INTO products (name, price, quantity, category_id) VALUES (?, ?, ?, ?)", [prod.name, prod.price, prod.quantity, newCatId]);
      }
    }

    await dbRun("COMMIT");
    res.json({ id: newSagraId, name: newName, status: 'active' });
  } catch (e) {
    await dbRun("ROLLBACK").catch(() => {});
    console.error(e);
    res.status(500).send(e.message);
  }
});


// GET Menu for specific Sagra
app.get('/api/sagras/:id/products', (req, res) => {
  const sagraId = req.params.id;
  const sql = `
      SELECT c.id as category_id, c.name as category, c.is_hidden as category_is_hidden, p.id, p.name, p.price, p.quantity
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      WHERE c.sagra_id = ?
      ORDER BY c.id, p.name
    `;

  db.all(sql, [sagraId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const grouped = {};
    const meta = {};

    rows.forEach(curr => {
      if (!grouped[curr.category]) {
        grouped[curr.category] = [];
        meta[curr.category] = { is_hidden: curr.category_is_hidden || 0 };
      }
      if (curr.id) {
        grouped[curr.category].push(curr);
      }
    });

    res.json({ products: grouped, meta });
  });
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
        for (const p of cat.products) {
          const qty = (p.quantity && p.quantity > 0) ? parseInt(p.quantity) : null;
          await dbRun("INSERT INTO products (name, price, quantity, category_id) VALUES (?, ?, ?, ?)", [p.name, p.price, qty, catId]);
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
  const { items, total, sagraId, printerName, template, testMode } = req.body;
  if (!items || items.length === 0) return res.status(400).send('Empty order');
  const targetSagra = sagraId || 1;

  try {
    await dbRun("BEGIN TRANSACTION");

    // 1. Inventory Check & Update
    for (const item of items) {
      if (item.id) {
        const rows = await dbAll("SELECT quantity FROM products WHERE id = ?", [item.id]);
        if (rows.length > 0) {
          const currentQty = rows[0].quantity;
          if (currentQty !== null) {
            if (currentQty < item.quantity) {
              throw new Error(`Scorte insufficienti per: ${item.name} (Rimasti: ${currentQty})`);
            }
            await dbRun("UPDATE products SET quantity = quantity - ? WHERE id = ?", [item.quantity, item.id]);
          }
        }
      }
    }

    // 2. Insert Order
    const result = await dbRun("INSERT INTO orders (total, sagra_id) VALUES (?, ?)", [total, targetSagra]);
    const orderId = result.lastID;

    // 3. Get Sequence Number
    const row = await dbAll("SELECT COUNT(*) as count FROM orders WHERE sagra_id = ?", [targetSagra]);
    const seq = row[0].count;
    await dbRun("UPDATE orders SET seq = ? WHERE id = ?", [seq, orderId]);

    // 4. Insert Items
    const stmt = db.prepare("INSERT INTO order_items (order_id, product_name, quantity, price) VALUES (?, ?, ?, ?)");
    for (const item of items) {
      stmt.run(orderId, item.name, item.quantity, item.price);
    }
    stmt.finalize();

    await dbRun("COMMIT");

    // 5. Printing / Test Mode Logic
    try {
      const receiptData = {
        seq: seq,
        items: items,
        total: total,
        date: new Date().toLocaleString('it-IT')
      };

      let printResult = null;
      if (template === 'split') {
        printResult = await generateSplitReceipt(receiptData);
      } else {
        printResult = await generateCompactReceipt(receiptData);
      }

      if (testMode) {
        console.log(`[TEST MODE] Order #${seq} saved. Skipping physical printer output.`);
        return res.json({ success: true, orderId: seq, testMode: true, preview: printResult.preview });
      }

      if (printerName) {
        const targetPrinter = printerName || "POS-80";
        console.log(`Printing Order #${seq} to "${targetPrinter}"...`);
        await printRawBuffer(printResult.buffer, targetPrinter);
      }

      res.json({ success: true, orderId: seq, preview: printResult.preview });

    } catch (printErr) {
      console.error("Printing Error:", printErr);
      res.json({ success: true, orderId: seq, warning: "Ordine salvato ma errore stampa: " + printErr.message });
      return;
    }

  } catch (err) {
    await dbRun("ROLLBACK");
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

  try {
    const totalRow = await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count, SUM(total) as revenue FROM orders WHERE sagra_id = ?", [sagraId], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });

    const topItems = await new Promise((resolve, reject) => {
      db.all(`
            SELECT product_name, SUM(quantity) as qty, SUM(price * quantity) as revenue 
            FROM order_items 
            WHERE order_id IN (SELECT id FROM orders WHERE sagra_id = ?)
            GROUP BY product_name 
            ORDER BY qty DESC
        `, [sagraId], (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });

    res.json({
      ordersCount: totalRow.count || 0,
      totalRevenue: totalRow.revenue || 0,
      topItems: topItems || []
    });

  } catch (e) {
    res.status(500).send(e.message);
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

// TEST PRINTER API
app.post('/api/print-test', async (req, res) => {
  const { printerName } = req.body;
  if (!printerName) {
    return res.status(400).json({ error: "Nessuna stampante selezionata" });
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

    res.json({ success: true });
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

// GET Dynamic App Version from package.json
app.get('/api/version', (req, res) => {
  const pkg = require('./package.json');
  res.json({ version: pkg.version });
});

// CHECK UPDATE API (GitHub Public Releases)
app.get('/api/check-update', (req, res) => {
  const owner = req.query.owner || 'Tremonzz';
  const repo = req.query.repo || 'Cassa-ProLoco';
  const pkg = require('./package.json');
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

  const options = {
    headers: {
      'User-Agent': 'SagraManager-App'
    }
  };

  https.get(url, options, (apiRes) => {
    let body = '';
    apiRes.on('data', chunk => body += chunk);
    apiRes.on('end', () => {
      try {
        if (apiRes.statusCode !== 200) {
          return res.json({ hasUpdate: false, currentVersion: pkg.version, status: 'no_release', message: 'Nessuna release pubblicata trovata su GitHub' });
        }

        const data = JSON.parse(body);
        const latestTag = (data.tag_name || '').replace(/^v/, '');
        const releaseNotes = data.body || '';

        // Find .exe asset if available
        let exeAsset = (data.assets || []).find(a => a.name && a.name.endsWith('.exe'));
        let downloadUrl = exeAsset ? exeAsset.browser_download_url : data.html_url;

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

        const hasUpdate = semverCompare(latestTag, pkg.version) > 0;

        res.json({
          hasUpdate,
          currentVersion: pkg.version,
          latestVersion: latestTag,
          releaseNotes,
          downloadUrl,
          releaseUrl: data.html_url
        });

      } catch (e) {
        res.status(500).json({ error: 'Errore durante la lettura delle informazioni di aggiornamento' });
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ error: 'Impossibile connettersi a GitHub: ' + err.message });
  });
});

// DOWNLOAD & AUTO-INSTALL UPDATE API
app.post('/api/download-and-install', (req, res) => {
  const { downloadUrl } = req.body;
  if (!downloadUrl) return res.status(400).json({ error: 'URL di download non fornito' });

  // If it's not a direct .exe URL (e.g. webpage URL), notify client
  if (!downloadUrl.endsWith('.exe')) {
    return res.json({ success: false, redirectUrl: downloadUrl, message: 'Reindirizzamento alla pagina di release' });
  }

  const tempDir = os.tmpdir();
  const destPath = path.join(tempDir, `GestioneOrdini_Update_${Date.now()}.exe`);

  const downloadFile = (url, dest, callback) => {
    const file = fs.createWriteStream(dest);
    const request = https.get(url, { headers: { 'User-Agent': 'SagraManager-App' } }, (response) => {
      // Handle HTTP redirects (GitHub Releases redirect to S3 storage)
      if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        return downloadFile(response.headers.location, dest, callback);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return callback(new Error(`Download fallito con codice di stato: ${response.statusCode}`));
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close(() => callback(null, dest));
      });
    });

    request.on('error', (err) => {
      fs.unlink(dest, () => {});
      callback(err);
    });
  };

  downloadFile(downloadUrl, destPath, (err, filePath) => {
    if (err) {
      console.error("Errore download installer:", err);
      return res.status(500).json({ error: 'Impossibile scaricare l\'aggiornamento: ' + err.message });
    }

    res.json({ success: true, message: 'Download completato. Avvio dell\'installatore...' });

    // Launch downloaded installer & close application
    setTimeout(() => {
      try {
        const { spawn } = require('child_process');
        const child = spawn(filePath, [], {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();

        // Close Electron app
        try {
          const { app: electronApp } = require('electron');
          if (electronApp) electronApp.quit();
          else process.exit(0);
        } catch (e) {
          process.exit(0);
        }
      } catch (e) {
        console.error("Errore avvio installer:", e);
      }
    }, 800);
  });
});

app.listen(port, () => {
  console.log(`Evento App listening at http://localhost:${port}`);
});
