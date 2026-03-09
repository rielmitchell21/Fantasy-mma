require("dotenv").config();

const { initializeDatabase, pool } = require("../src/db");

async function run() {
  try {
    await initializeDatabase();
    console.log("Database initialized successfully.");
  } catch (error) {
    console.error("Database init failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
