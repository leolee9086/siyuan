
import { describe, it, expectTypeOf } from "vitest";
import { type } from "arktype";

describe("ArkType Deep Distribution", () => {
    it("should distribute nested unions", () => {
        const full = type({ nested: { key: "'A' | 'B'" } });
        type Full = typeof full.infer;

        // Is Full: { nested: { key: 'A' } } | { nested: { key: 'B' } } ?
        // Or: { nested: { key: 'A' | 'B' } } ?

        type IsDistributed = Full extends { nested: { key: 'A' } } ? true : false;

        expectTypeOf<IsDistributed>().toEqualTypeOf<boolean>();
    });
});
