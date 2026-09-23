export {
  cited,
  estimated,
  unavailable,
  verified,
} from "@/lib/provenance/assign";

export {
  isStale,
  METADATA_MAX_AGE_MS,
  RATING_MAX_AGE_MS,
} from "@/lib/provenance/staleness";

export {
  FIELD_TIERS,
  NO_INFERENCE,
  tierFor,
} from "@/lib/provenance/tiers";

export type { FieldKey } from "@/lib/provenance/tiers";
