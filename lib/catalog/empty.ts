import type { Catalog } from "@/lib/catalog/types";

export function emptyCatalog(): Catalog {
  return {
    async findByName() {
      return null;
    },

    async ratings() {
      return [];
    },

    async charts() {
      return [];
    },

    async finalists() {
      return [];
    },

    async ranked() {
      return [];
    },
  };
}
