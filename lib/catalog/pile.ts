import { openCatalog } from "@/lib/scrape/store";

export type PileIcon = {
  trackId: number;

  name: string;

  iconUrl: string;
};

export type PileScene = {
  icons: PileIcon[];

  indexed: number;
};

export function pileScene(): PileScene {
  const db = openCatalog();

  try {
    const count = db.prepare(
      "select count(*) as n from apps",
    ).get() as { n: number };

    const rows = db.prepare(`
      select
        track_id as trackId,
        name,
        icon_url as iconUrl
      from apps
      where icon_url != ''
      order by track_id
      limit 96
    `).all() as PileIcon[];

    const icons = rows.map((row) => ({
      trackId: Number(row.trackId),
      name: String(row.name),
      iconUrl: String(row.iconUrl),
    }));

    return {
      icons,
      indexed: Number(count.n),
    };
  } finally {
    db.close();
  }
}
