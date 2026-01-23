
import { describe, it, expect, expectTypeOf } from "vitest";
import { type } from "arktype";
import { calibur } from "../src/index.js";

describe("Type Narrowing Verification", () => {
    it("should narrow object properties in remain handler", () => {
        // Define a schema with a union property
        const schema = type({
            key: "'A' | 'B'",
            other: "boolean"
        });

        const dispatch = calibur.universe(schema)
            .split(
                type({ key: "'A'" }),
                () => "Handled A"
            )
            .remain((state) => {
                // Here we verify the type narrowing.
                // If Exclude works as expected (due to ArkType distribution),
                // state.key should be 'B'.

                checkType(state);
                return state.key;
            })
            .build();

        // Runtime check
        expect(dispatch({ key: "B", other: true })).toBe("B");
    });
});

function checkType(state: { key: "B", other: boolean }) {
    // This function only accepts the narrowed type.
    // If 'state' was not narrowed (e.g. key was still 'A' | 'B'), this would be a compile error.
    // Since we can't easily assert compile errors in runtime tests without tools like tsd,
    // we rely on the fact that if this compiles, the type is compatible.

    // To be extra sure, we can use expectTypeOf from vitest
    expectTypeOf(state).toEqualTypeOf<{ key: "B", other: boolean }>();
}
