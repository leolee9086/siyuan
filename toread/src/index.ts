import { createHNSWIndex } from './vector';
import { createHNSWIndex as createHNSWIndexGeneric } from './generic';
export const hnsw = {
  createIndex: createHNSWIndex,
  createIndexGeneric: createHNSWIndexGeneric,
}