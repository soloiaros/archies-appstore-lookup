import { SectionPage } from "@/components/DirectionalPage";

import { QueryScreen } from "@/components/QueryScreen";

import { pileAtlas } from "@/lib/atlas";

import { shownIndexedCount } from "@/lib/catalog/shown-count";

import { formatPrice, sponsorPriceCents } from "@/lib/site/price";

import { fallbackSlots, listSlots } from "@/lib/site/slots";

export const dynamic = "force-dynamic";

const PILE = 300;

const shuffle = <T,>(list: T[]) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [list[i], list[j]] = [list[j], list[i]];
  }

  return list;
};

export default async function SearchPage() {
  const atlas = pileAtlas();

  const counted = await shownIndexedCount(
    atlas?.indexed ?? atlas?.ids.length ?? 0,
  );

  let indexed = counted;

  let loose: Array<{
    id: string;

    src: string;

    at: number;
  }> = [];

  if (atlas) {
    loose = atlas.srcs.map((src, at) => ({
      id: atlas.ids[at] ?? String(at),
      src,
      at,
    }));
  } else {
    try {
      const { pileScene } = await import(
        "@/lib/catalog/pile"
      );

      const scene = pileScene(PILE);

      if (indexed === 0) {
        indexed = scene.indexed;
      }

      loose = scene.icons.map((icon) => ({
        id: String(icon.trackId),
        src: icon.iconUrl,
        at: -1,
      }));
    } catch {
      loose = [];
    }
  }

  const shown = shuffle(loose).slice(0, PILE);

  const slots = await listSlots().catch(() => fallbackSlots());

  return (
    <SectionPage>
      <link
        rel="preload"
        as="image"
        href="/atlas/pile.webp"
        fetchPriority="high"
      />
      <div className="search-lock">
        <QueryScreen
          icons={shown}
          indexed={indexed}
          slots={slots}
          priceLabel={formatPrice(sponsorPriceCents())}
          sheet={
            atlas
              ? {
                  url: atlas.sheet,
                  cell: atlas.cell,
                  gutter: atlas.gutter,
                  cols: atlas.cols,
                }
              : null
          }
        />
      </div>
    </SectionPage>
  );
}
