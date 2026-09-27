export const SPONSOR_OPEN = "sponsor:open";

export type SponsorOpenDetail = {
  slotId: number | null;
};

export function openSponsor(slotId: number | null) {
  window.dispatchEvent(
    new CustomEvent<SponsorOpenDetail>(SPONSOR_OPEN, {
      detail: { slotId },
    }),
  );
}
