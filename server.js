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
        await dbRun("INSERT INTO products (name, price, quantity, is_composite, is_selection, components, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)", [prod.name, prod.price, prod.quantity, prod.is_composite || 0, prod.is_selection || 0, prod.components || null, newCatId]);
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
                const compRows = await dbAll(`
                  SELECT p.id, p.name, p.quantity 
                  FROM products p 
                  JOIN categories c ON p.category_id = c.id 
                  WHERE c.sagra_id = ? AND p.name = ?
                `, [targetSagra, compName]);

                if (compRows.length > 0) {
                  const comp = compRows[0];
                  if (comp.quantity !== null) {
                    if (!stockDeductions[comp.id]) {
                      stockDeductions[comp.id] = { id: comp.id, name: comp.name, currentQty: comp.quantity, requiredQty: 0 };
                    }
                    stockDeductions[comp.id].requiredQty += item.quantity;
                  }
                }
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
      const result = await dbRun("INSERT INTO orders (total, sagra_id) VALUES (?, ?)", [total, targetSagra]);
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
let updateProgress = { status: 'idle', percent: 0, downloadedMb: '0.0', totalMb: '0.0', error: null };

app.get('/api/update-progress', (req, res) => {
  res.json(updateProgress);
});

app.post('/api/download-and-install', (req, res) => {
  const { downloadUrl } = req.body;
  if (!downloadUrl) return res.status(400).json({ error: 'URL di download non fornito' });

  // If it's not a direct .exe URL (e.g. webpage URL), notify client
  if (!downloadUrl.endsWith('.exe')) {
    return res.json({ success: false, redirectUrl: downloadUrl, message: 'Reindirizzamento alla pagina di release' });
  }

  const tempDir = os.tmpdir();
  const destPath = path.join(tempDir, `GestioneOrdini_Update_${Date.now()}.exe`);

  updateProgress = { status: 'downloading', percent: 0, downloadedMb: '0.0', totalMb: '0.0', error: null };

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
        const err = new Error(`Download fallito (status: ${response.statusCode})`);
        updateProgress = { status: 'error', percent: 0, downloadedMb: '0.0', totalMb: '0.0', error: err.message };
        return callback(err);
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
        const downloadedMb = (downloadedBytes / (1024 * 1024)).toFixed(1);
        const totalMb = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : '?';

        updateProgress = {
          status: 'downloading',
          percent: percent,
          downloadedMb: downloadedMb,
          totalMb: totalMb,
          error: null
        };
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          updateProgress = { status: 'completed', percent: 100, downloadedMb: updateProgress.downloadedMb, totalMb: updateProgress.totalMb, error: null };
          callback(null, dest);
        });
      });
    });

    request.on('error', (err) => {
      fs.unlink(dest, () => {});
      updateProgress = { status: 'error', percent: 0, downloadedMb: '0.0', totalMb: '0.0', error: err.message };
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
