export async function fetchCurrentUser() {
  const response = await fetch("/api/auth/me");
  if (!response.ok) return null;
  const data = await response.json();
  return data.user || null;
}
