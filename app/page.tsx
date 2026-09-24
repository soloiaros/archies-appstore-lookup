import { QueryScreen } from "@/components/QueryScreen";

import { pileAtlas } from "@/lib/atlas";

import { pileScene } from "@/lib/catalog/pile";

export const dynamic = "force-dynamic";

const PILE = 300;

const shuffle = <T,>(list: T[]) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [list[i], list[j]] = [list[j], list[i]];
  }

  return list;
};

export default function Page() {
  const scene = pileScene(PILE);

  const atlas = pileAtlas();

  const packed = atlas
    ? shuffle(
      atlas.srcs.map((src, at) => ({
        id: atlas.ids[at],
        src,
        at,
      })),
    )
    : shuffle(
      scene.icons.map((icon) => ({
        id: String(icon.trackId),
        src: icon.iconUrl,
        at: -1,
      })),
    );

  const shown = packed.slice(0, PILE);

  return (
    <QueryScreen
      icons={shown}
      indexed={scene.indexed}
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
  );
}
