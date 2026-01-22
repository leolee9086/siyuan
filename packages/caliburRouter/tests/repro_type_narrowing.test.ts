
import { describe, it, expect } from "vitest";

// Proposed fix
type SetDifference<T, U> = T extends object
    ? U extends object
    ? {
        [K in keyof U & keyof T]: {
            [P in keyof T]: P extends K ? Exclude<T[P], U[P & keyof U]> : T[P]
        }
    }[keyof U & keyof T]
    : Exclude<T, U>
    : Exclude<T, U>;

type CollapseNever<T> = T extends { [K in keyof T]: infer U }
    ? [U] extends [never] ? never : T // Weak check
    : never;

// Better test helper
type Is<T, U> = [T] extends [U] ? [U] extends [T] ? true : false : false;

describe("SetDifference Utility", () => {
    it("should correctly subtract object types", () => {
        type Whole = {
            key: 'A' | 'B';
            other: boolean;
        };
        type Part = {
            key: 'A';
        };

        type Remainder = SetDifference<Whole, Part>;
        // Expected: { key: 'B', other: boolean }
        // Formula gives: { key: Exclude<'A'|'B', 'A'>, other: boolean } 
        // = { key: 'B', other: boolean }

        const t1: Remainder = { key: 'B', other: true };
        // @ts-expect-error
        const t2: Remainder = { key: 'A', other: true };
    });

    it("should handle multiple keys", () => {
        type Whole = { a: 1 | 2; b: 1 | 2 };
        type Part = { a: 1; b: 1 };

        type Remainder = SetDifference<Whole, Part>;
        // Term 1 (K='a'): { a: Exclude<1|2, 1>, b: 1|2 } = { a: 2, b: 1|2 }
        // Term 2 (K='b'): { a: 1|2, b: Exclude<1|2, 1> } = { a: 1|2, b: 2 }
        // Union: { a: 2, b: 1|2 } | { a: 1|2, b: 2 }

        // (2,2) is in both. (1,2) in Term 2. (2,1) in Term 1.
        // (1,1) is in neither. Correct.

        const v1: Remainder = { a: 1, b: 2 }; // OK
        const v2: Remainder = { a: 2, b: 1 }; // OK
        const v3: Remainder = { a: 2, b: 2 }; // OK
        // @ts-expect-error
        const v4: Remainder = { a: 1, b: 1 }; // Should Error
    });

    it("should handle disjoint keys", () => {
        // If U specifies a key that doesn't affect T? 
        // But TS keyof U & keyof T handles intersection.
    });

});
