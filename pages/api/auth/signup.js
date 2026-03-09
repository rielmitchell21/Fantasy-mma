const bcrypt = require("bcryptjs");
const { query } = require("../../../lib/db");
const { createSession } = require("../../../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, email, password } = req.body || {};
  const cleanUsername = (username || "").trim();
  const cleanEmail = (email || "").trim().toLowerCase();

  if (cleanUsername.length < 3 || !cleanEmail.includes("@") || (password || "").length < 8) {
    return res.status(400).json({
      error: "Username must be 3+ chars, valid email required, password 8+ chars."
    });
  }

  try {
    const exists = await query(
      "SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1",
      [cleanUsername, cleanEmail]
    );
    if (exists.rows[0]) {
      return res.status(409).json({ error: "Username or email already in use." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await query(
      `
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, username, email
    `,
      [cleanUsername, cleanEmail, passwordHash]
    );
    const user = created.rows[0];

    await createSession(res, user.id);
    return res.status(201).json({ user });
  } catch (error) {
    return res.status(500).json({ error: "Signup failed." });
  }
};
