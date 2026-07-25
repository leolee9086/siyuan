import { describe, expectTypeOf, it } from "vitest";
import { type } from "arktype";

type IsKeyUnionDistributed<T> = T extends { key: "A" } ? true : false;

describe("ArkType property union inference", () => {
    it("preserves a property union without normalizing it to an object union", () => {
        const full = type({ key: "'A' | 'B'", other: "boolean" });
        type Full = typeof full.infer;

        expectTypeOf<Full>().toEqualTypeOf<{ key: "A" | "B", other: boolean }>();
        expectTypeOf<IsKeyUnionDistributed<Full>>().toEqualTypeOf<false>();
    });
});
