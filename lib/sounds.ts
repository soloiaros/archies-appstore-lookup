const COIN_SRCS = [
  "/sounds/coin_insert_1.mp3",
  "/sounds/coin_insert_2.mp3",
  "/sounds/coin_insert_3.mp3",
] as const;

const FALL_SRC = "/sounds/vending_machine_fall.mp3";

const BUTTON_SRC = "/sounds/button_press.mp3";

const POOL = 4;

type Pool = {
  src: string;
  slots: HTMLAudioElement[];
  next: number;
};

const pools = new Map<string, Pool>();

function getPool(src: string): Pool {
  let pool = pools.get(src);

  if (pool) {
    return pool;
  }

  const slots = Array.from({ length: POOL }, () => {
    const audio = new Audio(src);
    audio.preload = "auto";
    return audio;
  });

  pool = { src, slots, next: 0 };
  pools.set(src, pool);
  return pool;
}

function playSrc(src: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const pool = getPool(src);
  const audio = pool.slots[pool.next];
  pool.next = (pool.next + 1) % pool.slots.length;

  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

export function playCoinSound(): void {
  const src = COIN_SRCS[Math.floor(Math.random() * COIN_SRCS.length)];
  playSrc(src);
}

export function playFallSound(): void {
  playSrc(FALL_SRC);
}

export function playButtonSound(): void {
  playSrc(BUTTON_SRC);
}

/** Fall cue fires this many ms before FALL_MS ends. */
export const FALL_SOUND_LEAD_MS = 200;
