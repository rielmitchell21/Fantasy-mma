function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function toBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1" || value === "on";
}

module.exports = {
  generateInviteCode,
  toBoolean
};
