const bcrypt = require("bcryptjs");
const { query } = require("../../../lib/db");
const { createSession } = require("../../../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { identifier, password } = req.body || {};
  const cleanIdentifier = (identifier || "").trim();

  if (!cleanIdentifier || !password) {
    return res.status(400).json({ error: "Identifier and password are required." });
  }

  try {
    const found = await query(
      `
      SELECT id, username, email, password_hash
      FROM users
      WHERE username = $1 OR email = $2
      LIMIT 1
    `,
      [cleanIdentifier, cleanIdentifier.toLowerCase()]
    );
    const user = found.rows[0];
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    await createSession(res, user.id);
    return res.status(200).json({
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    return res.status(500).json({ error: "Login failed." });
  }
};
