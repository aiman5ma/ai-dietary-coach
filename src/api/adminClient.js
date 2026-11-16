async function readPayload(response) {
  return response.json().catch(() => ({}));
}

function failed(payload, fallback) {
  const error = new Error(payload?.error?.message || fallback);
  error.code = payload?.error?.code || "";
  return error;
}

export async function adminWhoami(token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch("/api/admin?action=whoami", { headers });
  const payload = await readPayload(response);
  if (!response.ok) return false;
  return payload?.isAdmin === true;
}

export async function adminAction(token, action, body = {}) {
  const response = await fetch("/api/admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const payload = await readPayload(response);
  if (!response.ok) throw failed(payload, "Request failed.");
  return payload;
}
