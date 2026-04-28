const Database = require("better-sqlite3");
const db = new Database("bookmarks.db");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER,
    FOREIGN KEY(parent_id) REFERENCES folders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    folder_id INTEGER NOT NULL,
    FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE CASCADE
  );
`);

console.log("Tables created.");

// Check if data exists
const count = db.prepare("SELECT count(*) as count FROM folders").get();

if (count.count === 0) {
  console.log("Seeding initial data...");

  // Seed data
  const folders = [
    { name: "Personal 👤", parent_id: null },
    { name: "Qara'a 📖", parent_id: null },
    { name: "Hotama 💼", parent_id: null },
    { name: "Operational ⚙️", parent_id: null },
  ];

  const insertFolder = db.prepare(
    "INSERT INTO folders (name, parent_id) VALUES (?, ?)"
  );

  const rootFolders = {};

  for (const folder of folders) {
    const result = insertFolder.run(folder.name, folder.parent_id);
    rootFolders[folder.name] = result.lastInsertRowid;
  }

  // Subfolders for Qara'a
  const qaraaId = rootFolders["Qara'a 📖"];
  if (qaraaId) {
    const sub = ["Nuon", "India", "SIDAQ", "Other"];
    for (const name of sub) {
      insertFolder.run(name, qaraaId);
    }
  }

  // Subfolders for Hotama (Projects) - none specified but good to leave space

  console.log("Database initialized and seeded!");
} else {
  console.log("Database already contains data, skipping seed.");
}
