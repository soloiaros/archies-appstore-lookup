const WINDOW = 30_000;

export class Presence {
  private sessions = new Map<string, number>();

  constructor(_state: unknown) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    const now = Date.now();

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
