import { QueryScreen } from "@/components/QueryScreen";

import { pileScene } from "@/lib/catalog/pile";

export default function Page() {
  const scene = pileScene();

  return (
    <QueryScreen
      icons={scene.icons}
      indexed={scene.indexed}
    />
  );
}
