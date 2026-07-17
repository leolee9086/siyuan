import {describe, expect, test} from "bun:test";
import {
    createBloomFilter,
    createBloomFilterFromItems,
    createBloomFilterFromState,
    createBloomFilterOptimal,
    ScalableBloomFilter,
} from "./src/index";

describe("BloomFilter", () => {
    test("finds every inserted value", () => {
        const filter = createBloomFilter({size: 1024, hashes: 5});
        filter.add("hello");
        filter.add("世界");
        expect(filter.has("hello")).toBe(true);
        expect(filter.has("世界")).toBe(true);
        expect(filter.mayContain("hello")).toBe(true);
    });

    test("clears all bits and insertion count", () => {
        const filter = createBloomFilter({size: 1024, hashes: 5});
        filter.add("hello");
        filter.clear();
        expect(filter.has("hello")).toBe(false);
        expect(filter.count).toBe(0);
        expect(filter.loadFactor).toBe(0);
    });

    test("rejects invalid optimal parameters", () => {
        expect(() => createBloomFilterOptimal({expectedInsertions: 0, falsePositiveRate: 0.01})).toThrow("positive");
        expect(() => createBloomFilterOptimal({expectedInsertions: 10, falsePositiveRate: 0})).toThrow("between");
        expect(() => createBloomFilterOptimal({expectedInsertions: 10, falsePositiveRate: 1})).toThrow("between");
    });

    test("keeps measured false positives near the configured target", () => {
        const filter = createBloomFilterOptimal({expectedInsertions: 5000, falsePositiveRate: 0.01});
        for (let i = 0; i < 5000; i++) {
            filter.add(`inserted-${i}`);
        }
        let falsePositives = 0;
        for (let i = 0; i < 10000; i++) {
            if (filter.has(`missing-${i}`)) {
                falsePositives++;
            }
        }
        expect(falsePositives / 10000).toBeLessThan(0.03);
    });

    test("round-trips through JSON state", () => {
        const filter = createBloomFilterFromItems(["one", "two", "three"], {size: 1024, hashes: 4});
        const restored = createBloomFilterFromState(JSON.parse(JSON.stringify(filter.exportState())));
        expect(restored.has("one")).toBe(true);
        expect(restored.has("two")).toBe(true);
        expect(restored.has("three")).toBe(true);
        expect(restored.count).toBe(3);
    });
});

describe("ScalableBloomFilter", () => {
    test("grows in segments without false negatives", () => {
        const filter = new ScalableBloomFilter({initialCapacity: 32, falsePositiveRate: 0.001});
        for (let i = 0; i < 10000; i++) {
            filter.add(`history-${i}`);
        }
        for (let i = 0; i < 10000; i++) {
            expect(filter.has(`history-${i}`)).toBe(true);
        }
        expect(filter.segmentCount).toBeGreaterThan(1);
        expect(filter.count).toBe(10000);
    });

    test("does not authorize an unknown item by itself", () => {
        const filter = new ScalableBloomFilter({initialCapacity: 64, falsePositiveRate: 0.0001});
        for (let i = 0; i < 1000; i++) {
            filter.add(`known-${i}`);
        }
        expect(filter.has("never-issued-token")).toBe(false);
    });
});
