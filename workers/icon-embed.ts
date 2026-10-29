import { Container } from "@cloudflare/containers";

const LAST_ACTIVITY = "icon-embed:last-activity";

const IDLE_MS = 2 * 60 * 1000;

export class IconEmbed extends Container {
  defaultPort = 8788;

  sleepAfter = "2m";

  enableInternet = true;

  private activeRequests = 0;

  override async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === "/idle-check") {
      if (request.method !== "POST") {
        return new Response(null, { status: 405 });
      }

      const stopped = await this.stopIfIdle();

      return Response.json({ stopped });
    }

    this.activeRequests += 1;

    try {
      await this.ctx.storage.put(LAST_ACTIVITY, Date.now());
      return await super.fetch(request);
    } finally {
      this.activeRequests -= 1;
      await this.ctx.storage.put(LAST_ACTIVITY, Date.now());
    }
  }

  override async alarm(...args: Parameters<Container["alarm"]>): Promise<void> {
    try {
      await super.alarm(...args);
    } finally {
      await this.stopIfIdle();
    }
  }

  override async onActivityExpired(): Promise<void> {
    await this.stopIfIdle();
  }

  private async stopIfIdle(): Promise<boolean> {
    if (!this.ctx.container.running || this.activeRequests > 0) {
      return false;
    }

    const lastActivity = await this.ctx.storage.get<number>(LAST_ACTIVITY);

    if (
      typeof lastActivity === "number"
      && Date.now() - lastActivity < IDLE_MS
    ) {
      return false;
    }

    // The model is stateless. Use a hard stop because graceful SIGTERM has not
    // reliably released the existing instance in production.
    await this.destroy();

    return true;
  }
}
