const crypto = require("crypto");
const { parse, serialize } = require("cookie");
const { query } = require("./db");

const SESSION_COOKIE = "fantasy_ufc_session";
const SESSION_TTL_DAYS = 14;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getCookieToken(req) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = parse(cookieHeader);
  return cookies[SESSION_COOKIE] || null;
}

function createSessionCookie(token) {
  return serialize(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60
  });
}

function clearSessionCookie() {
  return serialize(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  await query(
    `
    INSERT INTO sessions (user_id, token_hash, expires_at)
    VALUES ($1, $2, NOW() + INTERVAL '${SESSION_TTL_DAYS} days')
  `,
    [userId, tokenHash]
  );

  res.setHeader("Set-Cookie", createSessionCookie(token));
}

async function destroySession(req, res) {
  const token = getCookieToken(req);
  if (token) {
    const tokenHash = hashToken(token);
    await query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
  }
  res.setHeader("Set-Cookie", clearSessionCookie());
}

async function getAuthUser(req) {
  const token = getCookieToken(req);
  if (!token) return null;

  const tokenHash = hashToken(token);
  const { rows } = await query(
    `
    SELECT u.id, u.username, u.email
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1
      AND s.expires_at > NOW()
    LIMIT 1
  `,
    [tokenHash]
  );

  return rows[0] || null;
}

async function requireAuth(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return user;
}

module.exports = {
  createSession,
  destroySession,
  getAuthUser,
  requireAuth
};
