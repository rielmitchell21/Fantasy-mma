const crypto = require("crypto");
const { parse, serialize } = require("cookie");
const { query } = require("./db");

const SESSION_COOKIE_NAME = "fantasy_ufc_session";
const SESSION_DAYS = 14;

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function parseCookieToken(req) {
  const rawCookie = req.headers.cookie || "";
  const parsed = parse(rawCookie);
  return parsed[SESSION_COOKIE_NAME] || null;
}

function buildSessionCookie(token) {
  return serialize(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
    path: "/"
  });
}

function buildClearCookie() {
  return serialize(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/"
  });
}

async function createUserSession(res, userId) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);

  await query(
    `
      INSERT INTO sessions (user_id, token_hash, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '${SESSION_DAYS} days')
    `,
    [userId, tokenHash]
  );

  res.setHeader("Set-Cookie", buildSessionCookie(rawToken));
}

async function clearUserSession(req, res) {
  const token = parseCookieToken(req);
  if (token) {
    await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  }
  res.setHeader("Set-Cookie", buildClearCookie());
}

async function getCurrentUser(req) {
  const token = parseCookieToken(req);
  if (!token) return null;

  const result = await query(
    `
      SELECT u.id, u.username, u.email
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > NOW()
      LIMIT 1
    `,
    [hashToken(token)]
  );

  return result.rows[0] || null;
}

async function requireAuth(req, res, next) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: "Authentication failed." });
  }
}

module.exports = {
  createUserSession,
  clearUserSession,
  getCurrentUser,
  requireAuth
};
