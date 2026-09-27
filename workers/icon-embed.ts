import { Container } from "@cloudflare/containers";

export class IconEmbed extends Container {
  defaultPort = 8788;

  sleepAfter = "10m";

  enableInternet = true;
}
