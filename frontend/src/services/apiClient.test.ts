import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/utils/errors";
import { apiClient, buildQuery } from "./apiClient";
import { paymentService } from "./paymentService";
import { session, setUnauthorizedHandler } from "./session";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit & { headers: Record<string, string> } } {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("fetch was not called");
  return { url: String(call[0]), init: call[1] as RequestInit & { headers: Record<string, string> } };
}

describe("buildQuery", () => {
  it("drops unset filters so they never reach the URL", () => {
    expect(buildQuery({ q: "ana", status: undefined, company: "", has_due: false, limit: 20, none: null })).toBe(
      "?q=ana&has_due=false&limit=20",
    );
    expect(buildQuery({})).toBe("");
    expect(buildQuery(undefined)).toBe("");
  });
});

describe("apiClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setUnauthorizedHandler(null);
  });

  it("sends the bearer token on authenticated calls", async () => {
    session.setToken("abc123");
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await apiClient.get("/auth/me");
    expect(lastCall(fetchMock).init.headers.Authorization).toBe("Bearer abc123");
  });

  it("does not send the token on public calls", async () => {
    session.setToken("abc123");
    fetchMock.mockResolvedValue(jsonResponse({ access_token: "t" }));
    await apiClient.post("/auth/login", { username: "a", password: "b" }, { auth: false });
    expect(lastCall(fetchMock).init.headers.Authorization).toBeUndefined();
  });

  it("serialises JSON bodies and adds query strings", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({})));
    await apiClient.get("/customers/search", { query: { q: "ana", limit: 20 } });
    expect(lastCall(fetchMock).url).toContain("/customers/search?q=ana&limit=20");
    await apiClient.post("/orders", { items: [] });
    expect(lastCall(fetchMock).init.body).toBe(JSON.stringify({ items: [] }));
  });

  it("turns backend errors into ApiError with code, message and field details", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: "validation_error", message: "Invalid input", details: [{ field: "phone", message: "bad phone" }] } }, 422),
    );
    const error = await apiClient.post("/customers", {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const api = error as ApiError;
    expect(api.status).toBe(422);
    expect(api.code).toBe("validation_error");
    expect(api.details).toEqual([{ field: "phone", message: "bad phone" }]);
  });

  it("copes with non-JSON error bodies (e.g. a proxy's HTML page)", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));
    const error = (await apiClient.get("/x").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
  });

  it("reports an unreachable server as a network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const error = (await apiClient.get("/x").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.isNetwork).toBe(true);
  });

  it("signs the user out on 401 from an authenticated call", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: "unauthorized", message: "Token expired" } }, 401));
    await expect(apiClient.get("/orders")).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not sign out when the login itself returns 401", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: "invalid_credentials", message: "Incorrect username or password" } }, 401));
    await expect(apiClient.post("/auth/login", {}, { auth: false })).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns undefined for 204 No Content", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiClient.delete("/expenses/1")).resolves.toBeUndefined();
  });
});

describe("paymentService idempotency", () => {
  it("sends the Idempotency-Key header when recording a payment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "p1" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    await paymentService.record("order-1", { method: "cash" }, "key-123");
    const { url, init } = lastCall(fetchMock);
    expect(url).toContain("/orders/order-1/payments");
    expect(init.headers["Idempotency-Key"]).toBe("key-123");
  });

  it("sends the Idempotency-Key header when settling dues", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ settlement: {}, remaining_due: "0.00" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    await paymentService.settle({ customer_id: "c1", amount: "100", method: "cash" }, "key-456");
    expect(lastCall(fetchMock).init.headers["Idempotency-Key"]).toBe("key-456");
  });
});

describe("session storage", () => {
  it("keeps the token in sessionStorage and never in localStorage", () => {
    session.setToken("secret-token");
    expect(sessionStorage.getItem("chai-hut.access-token")).toBe("secret-token");
    expect(localStorage.length).toBe(0);
    session.clear();
    expect(session.getToken()).toBeNull();
  });
});
