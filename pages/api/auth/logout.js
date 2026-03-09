const { destroySession } = require("../../../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await destroySession(req, res);
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Logout failed." });
  }
};
