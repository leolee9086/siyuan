
import { describe, it, expectTypeOf } from "vitest";
import { type } from "arktype";

describe("ArkType Exclude Inference", () => {
    it("should infer object subtraction correctly", () => {
        const full = type({ key: "'A' | 'B'", other: "boolean" });
        const part = type({ key: "'A'" });

        // Check if runtime exclusion works on the type object
        const remaining = full.exclude(part);

        type Remaining = typeof remaining.infer;

        // If ArkType is smart, Remaining should be { key: 'B', other: boolean }
        // If it uses simple Exclude, it will be { key: 'A'|'B', ... }

        expectTypeOf<Remaining>().toEqualTypeOf<{ key: "B", other: boolean }>();
    });
});
