
import { describe, it, expectTypeOf } from "vitest";
import { type } from "arktype";

describe("ArkType Union Distribution", () => {
    it("should verify if ArkType distributes unions in objects", () => {
        const full = type({ key: "'A' | 'B'", other: "boolean" });
        type Full = typeof full.infer;

        // Check if Full is { key: 'A' } | { key: 'B' } ...
        // or { key: 'A' | 'B' } ...

        // This type matches both structures structurally, but strict equality might differ.
        // Actually { key: 'A' } | { key: 'B' } IS { key: 'A' | 'B' } in TS representation usually?
        // No, strict check might see difference.

        expectTypeOf<Full>().toEqualTypeOf<{ key: "A" | "B", other: boolean }>();

        // Let's check distribution behavior explicitly
        type Dist = Full extends { key: "A" } ? true : false;
        // If Full is a union, this conditional type resolves to boolean (true | false).
        // If Full is an object with union prop, it resolves to false (because {key: A|B} doesn't extend {key: A}).

        expectTypeOf<Dist>().toEqualTypeOf<boolean>(); // If union, it should be boolean (true|false)
        // If it's a single object, it should be false.
    });
});
