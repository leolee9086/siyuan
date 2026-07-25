import { describe, expect, expectTypeOf, it } from "vitest";
import { type } from "arktype";
import { calibur } from "../src/index.js";
import type { 切割后剩余 } from "../src/index.js";

describe("Calibur structural state subtraction", () => {
    it("subtracts a property branch without relying on ArkType branch exclusion", () => {
        const full = type({ key: "'A' | 'B'", other: "boolean" });
        const part = type({ key: "'A'" });
        type Remaining = 切割后剩余<typeof full.infer, typeof part.infer>;

        expectTypeOf<Remaining>().toEqualTypeOf<{ key: "B", other: boolean }>();

        const dispatch = calibur.universe(full)
            .split(part, () => "A" as const)
            .remain((state) => {
                expectTypeOf(state).toEqualTypeOf<{ key: "B", other: boolean }>();
                return state.key;
            })
            .build();

        expect(dispatch({ key: "A", other: true })).toBe("A");
        expect(dispatch({ key: "B", other: true })).toBe("B");
    });

    it("subtracts nested property branches", () => {
        const full = type({ nested: { key: "'A' | 'B'" }, other: "boolean" });
        const part = type({ nested: { key: "'A'" } });
        type Remaining = 切割后剩余<typeof full.infer, typeof part.infer>;

        expectTypeOf<Remaining>().toEqualTypeOf<{
            nested: { key: "B" };
            other: boolean;
        }>();
    });
});
