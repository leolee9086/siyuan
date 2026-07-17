export interface BloomFilterOptions {
    size?: number;
    hashes?: number;
    seed?: number;
}

export interface BloomFilterState {
    size: number;
    hashes: number;
    seed: number;
    count: number;
    buckets: number[];
}

export interface BloomFilter {
    add(item: string): void;
    has(item: string): boolean;
    mayContain(item: string): boolean;
    clear(): void;
    readonly size: number;
    readonly hashes: number;
    readonly count: number;
    readonly loadFactor: number;
    estimateFalsePositiveRate(): number;
    estimateCardinality(): number;
    exportState(): BloomFilterState;
    clone(): BloomFilter;
}

export interface ScalableBloomFilterOptions {
    initialCapacity?: number;
    falsePositiveRate?: number;
    growthFactor?: number;
    seed?: number;
}

function popcnt32(value: number): number {
    value -= (value >>> 1) & 0x55555555;
    value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
    return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function countSetBits(buckets: Int32Array): number {
    let bits = 0;
    for (let i = 0; i < buckets.length; i++) {
        bits += popcnt32(buckets[i]);
    }
    return bits;
}

function validateFilterParameters(size: number, hashes: number): void {
    if (!Number.isInteger(size) || size <= 0) {
        throw new Error("size must be a positive integer");
    }
    if (!Number.isInteger(hashes) || hashes <= 0) {
        throw new Error("hashes must be a positive integer");
    }
}

function hashPositions(item: string, size: number, hashes: number, seed: number, positions: Int32Array): void {
    const key = seed ? item + seed : item;
    let v0 = 0x2325;
    let v1 = 0x8422;
    let v2 = 0x9ce4;
    let v3 = 0xcbf2;
    let t0 = 0;
    let t1 = 0;
    let t2 = 0;
    let t3 = 0;
    for (let i = 0; i < key.length; i++) {
        v0 ^= key.charCodeAt(i);
        t0 = v0 * 0x01b3;
        t1 = v1 * 0x01b3;
        t2 = v2 * 0x01b3;
        t3 = v3 * 0x01b3;
        t2 += v0 << 8;
        t3 += v1 << 8;
        t1 += t0 >>> 16;
        v0 = t0 & 0xffff;
        t2 += t1 >>> 16;
        v1 = t1 & 0xffff;
        v3 = (t3 + (t2 >>> 16)) & 0xffff;
        v2 = t2 & 0xffff;
    }

    let first = (v3 << 16) | v2;
    let step = (v1 << 16) | v0;
    first %= size;
    if (first < 0) {
        first += size;
    }
    step %= size;
    if (step < 0) {
        step += size;
    }
    positions[0] = first;
    for (let i = 1; i < hashes; i++) {
        first = (first + step) % size;
        step = (step + i) % size;
        positions[i] = first;
    }
}

export class BloomFilterImpl implements BloomFilter {
    readonly size: number;
    readonly hashes: number;
    readonly seed: number;
    readonly buckets: Int32Array;
    private readonly positions: Int32Array;
    private insertionCount = 0;

    constructor(size: number, hashes: number, seed = 0, buckets?: Int32Array, count = 0) {
        validateFilterParameters(size, hashes);
        this.size = size;
        this.hashes = hashes;
        this.seed = seed;
        this.buckets = buckets ?? new Int32Array(Math.max(1, Math.ceil(size / 32)));
        if (this.buckets.length < Math.ceil(size / 32)) {
            throw new Error("buckets are smaller than the filter size");
        }
        this.insertionCount = Math.max(0, count);
        this.positions = new Int32Array(hashes);
    }

    add(item: string): void {
        hashPositions(item, this.size, this.hashes, this.seed, this.positions);
        for (let i = 0; i < this.positions.length; i++) {
            const position = this.positions[i];
            this.buckets[position >>> 5] |= 1 << (position & 0x1f);
        }
        this.insertionCount++;
    }

    has(item: string): boolean {
        hashPositions(item, this.size, this.hashes, this.seed, this.positions);
        for (let i = 0; i < this.positions.length; i++) {
            const position = this.positions[i];
            if ((this.buckets[position >>> 5] & (1 << (position & 0x1f))) === 0) {
                return false;
            }
        }
        return true;
    }

    mayContain(item: string): boolean {
        return this.has(item);
    }

    clear(): void {
        this.buckets.fill(0);
        this.insertionCount = 0;
    }

    get count(): number {
        return this.insertionCount;
    }

    get loadFactor(): number {
        return countSetBits(this.buckets) / this.size;
    }

    estimateFalsePositiveRate(): number {
        return Math.pow(this.loadFactor, this.hashes);
    }

    estimateCardinality(): number {
        const bits = countSetBits(this.buckets);
        if (bits === 0) {
            return 0;
        }
        return Math.round(-(this.size / this.hashes) * Math.log(1 - bits / this.size));
    }

    exportState(): BloomFilterState {
        return {
            size: this.size,
            hashes: this.hashes,
            seed: this.seed,
            count: this.count,
            buckets: Array.from(this.buckets),
        };
    }

    clone(): BloomFilter {
        return new BloomFilterImpl(this.size, this.hashes, this.seed, new Int32Array(this.buckets), this.count);
    }
}

export function createBloomFilter(options: BloomFilterOptions = {}): BloomFilter {
    const requestedSize = options.size ?? 256;
    const size = Math.max(32, Math.ceil(requestedSize / 32) * 32);
    const hashes = options.hashes ?? Math.max(1, Math.round((size / 256) * Math.LN2));
    return new BloomFilterImpl(size, hashes, options.seed ?? 0);
}

export function createBloomFilterOptimal(
    params: { expectedInsertions: number; falsePositiveRate: number },
    seed = 0,
): BloomFilter {
    const {expectedInsertions, falsePositiveRate} = params;
    if (!Number.isFinite(expectedInsertions) || expectedInsertions <= 0) {
        throw new Error("expectedInsertions must be positive");
    }
    if (!Number.isFinite(falsePositiveRate) || falsePositiveRate <= 0 || falsePositiveRate >= 1) {
        throw new Error("falsePositiveRate must be between 0 and 1 exclusive");
    }
    const ln2 = Math.LN2;
    const size = Math.max(32, Math.ceil(-(expectedInsertions * Math.log(falsePositiveRate)) / (ln2 * ln2)));
    const hashes = Math.max(1, Math.ceil((size / expectedInsertions) * ln2));
    return new BloomFilterImpl(size, hashes, seed);
}

export function createBloomFilterFromState(state: BloomFilterState): BloomFilter {
    if (!state || !Array.isArray(state.buckets)) {
        throw new Error("invalid Bloom filter state");
    }
    return new BloomFilterImpl(
        state.size,
        state.hashes,
        state.seed,
        new Int32Array(state.buckets),
        state.count,
    );
}

export function createBloomFilterFromItems(items: string[], options: BloomFilterOptions = {}): BloomFilter {
    const filter = createBloomFilter(options);
    for (let i = 0; i < items.length; i++) {
        filter.add(items[i]);
    }
    return filter;
}

/**
 * A grow-only filter made of bounded segments. A segment is never resized,
 * so inserting beyond the initial capacity cannot invalidate prior members.
 * False positives are still harmless because callers must perform exact lookup.
 */
export class ScalableBloomFilter {
    private readonly falsePositiveRate: number;
    private readonly growthFactor: number;
    private readonly seed: number;
    private readonly initialCapacity: number;
    private nextCapacity: number;
    private filters: BloomFilter[] = [];
    private insertionCount = 0;

    constructor(options: ScalableBloomFilterOptions = {}) {
        const initialCapacity = options.initialCapacity ?? 4096;
        if (!Number.isInteger(initialCapacity) || initialCapacity <= 0) {
            throw new Error("initialCapacity must be a positive integer");
        }
        const falsePositiveRate = options.falsePositiveRate ?? 0.001;
        if (!Number.isFinite(falsePositiveRate) || falsePositiveRate <= 0 || falsePositiveRate >= 1) {
            throw new Error("falsePositiveRate must be between 0 and 1 exclusive");
        }
        const growthFactor = options.growthFactor ?? 2;
        if (!Number.isFinite(growthFactor) || growthFactor <= 1) {
            throw new Error("growthFactor must be greater than 1");
        }
        this.falsePositiveRate = falsePositiveRate;
        this.growthFactor = growthFactor;
        this.seed = options.seed ?? 0;
        this.initialCapacity = initialCapacity;
        this.nextCapacity = initialCapacity;
    }

    add(item: string): void {
        let filter = this.filters[this.filters.length - 1];
        if (!filter || filter.count >= this.nextCapacity) {
            filter = createBloomFilterOptimal({
                expectedInsertions: this.nextCapacity,
                falsePositiveRate: this.falsePositiveRate,
            }, this.seed + this.filters.length);
            this.filters.push(filter);
            this.nextCapacity = Math.max(this.nextCapacity + 1, Math.ceil(this.nextCapacity * this.growthFactor));
        }
        filter.add(item);
        this.insertionCount++;
    }

    has(item: string): boolean {
        for (let i = this.filters.length - 1; i >= 0; i--) {
            if (this.filters[i].has(item)) {
                return true;
            }
        }
        return false;
    }

    mayContain(item: string): boolean {
        return this.has(item);
    }

    clear(): void {
        this.filters = [];
        this.insertionCount = 0;
        this.nextCapacity = this.initialCapacity;
    }

    get count(): number {
        return this.insertionCount;
    }

    get segmentCount(): number {
        return this.filters.length;
    }
}
