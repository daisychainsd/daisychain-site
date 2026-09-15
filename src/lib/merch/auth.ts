import { timingSafeEqual } from "node:crypto";

export class OpsRequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function requireOps(request: Request, mutation = false) {
  const password = process.env.OPS_PASSWORD;
  if (!password) throw new OpsRequestError("Not found", 404);
  let supplied = "";
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.startsWith("Basic ")) {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    if (decoded.includes(":")) supplied = decoded.slice(decoded.indexOf(":") + 1);
  }
  const a = Buffer.from(password), b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new OpsRequestError("Authentication required", 401);
  if (mutation && (request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site")) throw new OpsRequestError("Cross-origin request rejected", 403);
}

export function opsError(error: unknown) {
  const status = error instanceof OpsRequestError ? error.status : 500;
  if (status === 500) console.error("Merch Ops request failed:", error);
  return Response.json({ error: status === 500 ? "Could not complete this request. Please retry." : (error as Error).message }, {
    status, headers: { "Cache-Control": "no-store", ...(status === 401 ? { "WWW-Authenticate": 'Basic realm="Daisy Chain Ops"' } : {}) },
  });
}

export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
