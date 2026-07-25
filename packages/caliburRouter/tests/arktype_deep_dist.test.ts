import { describe, expectTypeOf, it } from "vitest";
import { type } from "arktype";

type IsNestedUnionDistributed<T> = T extends { nested: { key: "A" } } ? true : false;

describe("ArkType nested union inference", () => {
    it("preserves a nested property union without normalizing it to an object union", () => {
        const full = type({ nested: { key: "'A' | 'B'" } });
        type Full = typeof full.infer;

        expectTypeOf<Full>().toEqualTypeOf<{ nested: { key: "A" | "B" } }>();
        expectTypeOf<IsNestedUnionDistributed<Full>>().toEqualTypeOf<false>();
    });
});
