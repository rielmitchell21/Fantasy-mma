function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function toBool(value) {
  return value === true || value === "true" || value === "on" || value === 1 || value === "1";
}

module.exports = {
  generateInviteCode,
  toBool
};
