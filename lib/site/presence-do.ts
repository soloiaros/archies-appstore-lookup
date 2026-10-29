const WINDOW = 90_000;
const HOUR = 60 * 60 * 1000;
const RATE_LIMIT = 1800;
const MAX_IPS = 10_000;

export class Presence {
  private sessions = new Map<string, number>();
  private rateWindow = -1;
  private hits = new Map<string, number>();

  constructor(_state: unknown) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    const now = Date.now();

    if (url.pathname !== "/beat" && url.pathname !== "/count") {
      return new Response(null, { status: 404 });
    }

    const window = Math.floor(now / HOUR);

    if (window !== this.rateWindow) {
      this.rateWindow = window;
      this.hits.clear();
    }

    const ip = request.headers.get("x-presence-ip") ?? "unknown";
    const hits = this.hits.get(ip) ?? 0;

    if (hits >= RATE_LIMIT || (hits === 0 && this.hits.size >= MAX_IPS)) {
      return new Response(null, { status: 429 });
    }

    this.hits.set(ip, hits + 1);

    for (const [id, at] of this.sessions) {
      if (now - at > WINDOW) {
        this.sessions.delete(id);
      }
    }

    const sid = url.searchParams.get("sid");

    if (url.pathname === "/beat" && sid) {
      this.sessions.set(sid, now);
    }

    return Response.json({
      here: this.sessions.size,
    });
  }
}
