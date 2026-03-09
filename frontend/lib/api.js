export async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export async function getCurrentUser() {
  const data = await apiRequest("/api/auth/me", { method: "GET" });
  return data.user || null;
}
