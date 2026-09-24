import type { PileIcon } from "@/lib/catalog/pile";

export function IconPile({
  icons,
  dim,
}: {
  icons: PileIcon[];

  dim: boolean;
}) {
  return (
    <div
      className="pile"
      data-dim={dim ? "true" : "false"}
      aria-hidden="true"
    >
      {icons.map((icon, index) => (
        <img
          key={icon.trackId}
          className="pile-icon"
          src={icon.iconUrl}
          alt=""
          style={place(index, icons.length)}
        />
      ))}
    </div>
  );
}

function place(
  index: number,
  count: number,
): {
  left: string;

  top: string;

  transform: string;
} {
  const columns = 12;

  const column = index % columns;

  const row = Math.floor(index / columns);

  const rows = Math.max(
    1,
    Math.ceil(count / columns),
  );

  const nudge = (index * 17) % 9 - 4;

  const turn = (index * 29) % 16 - 8;

  return {
    left: `${3 + column * (94 / columns) + nudge * 0.15}%`,
    top: `${4 + row * (90 / rows) + nudge * 0.2}%`,
    transform: `rotate(${turn}deg)`,
  };
}
