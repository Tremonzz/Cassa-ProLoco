const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('sagra.db');

db.serialize(() => {
    console.log("Seeding started...");

    db.exec(`
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM products;
    DELETE FROM categories;
    DELETE FROM sqlite_sequence;

    INSERT INTO categories (id, name) VALUES (1, 'Cibo');
    INSERT INTO categories (id, name) VALUES (2, 'Bibite');
    INSERT INTO categories (id, name) VALUES (3, 'Dolci');

    INSERT INTO products (name, price, category_id) VALUES ('Pasta al Ragù', 8.00, 1);
    INSERT INTO products (name, price, category_id) VALUES ('Grigliata Mista', 12.00, 1);
    INSERT INTO products (name, price, category_id) VALUES ('Patatine Fritte', 4.00, 1);
    
    INSERT INTO products (name, price, category_id) VALUES ('Acqua 0.5L', 1.50, 2);
    INSERT INTO products (name, price, category_id) VALUES ('Birra Media', 5.00, 2);
    INSERT INTO products (name, price, category_id) VALUES ('Vino Rosso (bicchiere)', 3.00, 2);
    
    INSERT INTO products (name, price, category_id) VALUES ('Tiramisù', 4.50, 2);
    INSERT INTO products (name, price, category_id) VALUES ('Crostata', 3.50, 2);
  `, (err) => {
        if (err) {
            console.error("Exec Error:", err);
        } else {
            console.log("Seeding Executed Successfully.");
        }
    });
});

setTimeout(() => {
    db.close();
}, 1000);
