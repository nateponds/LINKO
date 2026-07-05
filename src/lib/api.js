/* Tiny fetch client for the LINKO backend.
   Sends cookies (same-origin), parses the {error:{message}} envelope into a
   thrown Error, and handles 204/empty responses. Modelled on AuthProvider. */

async function readJson(response) {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function request(path, { method = "GET", body } = {}) {
  const options = {
    method,
    credentials: "same-origin",
  };

  if (body !== undefined) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }

  const response = await fetch(path, options);
  const payload = await readJson(response);

  if (!response.ok) {
    const message =
      payload?.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export function apiGet(path) {
  return request(path);
}

export function apiSend(path, { method = "POST", body } = {}) {
  return request(path, { method, body });
}
