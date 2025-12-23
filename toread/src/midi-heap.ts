/**
 * MidiHeap - 中等容量优化的固定大小二叉堆
 * 
 * 基于MicroHeap的设计，但容量可配置。
 * 专为HNSW算法中的中等大小集合（例如64-1024个元素）优化，
 * 结合了数组的缓存友好性与预分配带来的高性能。
 */
export class MidiHeapGeneric<T> {
    private data: T[];
    private capacity: number;
    private size = 0;
    private compare: (a: T, b: T) => number;

    constructor(capacity: number, compare: (a: T, b: T) => number, initialData?: T[]) {
        if (capacity <= 0) {
            throw new Error('Heap capacity must be greater than 0');
        }
        this.capacity = capacity;
        this.data = new Array(capacity);
        this.compare = compare;

        if (initialData && initialData.length > 0) {
            const initialSize = Math.min(initialData.length, this.capacity);
            this.size = initialSize;
            for (let i = 0; i < initialSize; i++) {
                this.data[i] = initialData[i]!;
            }
            this.heapify();
        }
    }

    get length(): number {
        return this.size;
    }

    isFull(): boolean {
        return this.size >= this.capacity;
    }

    /**
     * 向堆中添加一个元素。
     * @注意 如果堆已满，此操作会静默失败。请使用 isFull() 检查。
     */
    push(item: T): void {
        if (this.isFull()) {
            return;
        }

        const data = this.data;
        const compare = this.compare;
        let pos = this.size++;

        while (pos > 0) {
            const parent = (pos - 1) >>> 1;
            if (compare(item, data[parent]!) >= 0) break;

            data[pos] = data[parent]!;
            pos = parent;
        }

        data[pos] = item;
    }

    pop(): T | undefined {
        if (this.size === 0) return undefined;

        const data = this.data;
        const top = data[0]!;
        const newSize = --this.size;

        if (newSize > 0) {
            data[0] = data[newSize]!;
            this.downHeap(0, newSize);
        }

        return top;
    }

    /**
     * 替换堆顶元素，比 pop() + push() 更高效。
     * @returns 返回被替换掉的原堆顶元素。
     */
    replace(item: T): T {
        const top = this.data[0]!;
        this.data[0] = item;
        this.downHeap(0, this.size);
        return top;
    }

    private downHeap(pos: number, size: number): void {
        const data = this.data;
        const compare = this.compare;
        const item = data[pos]!;

        while (true) {
            const leftChild = (pos << 1) + 1;
            if (leftChild >= size) break;

            let bestChild = leftChild;

            const rightChild = leftChild + 1;
            if (rightChild < size && compare(data[rightChild]!, data[leftChild]!) < 0) {
                bestChild = rightChild;
            }

            if (compare(item, data[bestChild]!) <= 0) break;

            data[pos] = data[bestChild]!;
            pos = bestChild;
        }

        data[pos] = item;
    }

    peek(): T | undefined {
        return this.size > 0 ? this.data[0] : undefined;
    }

    peekUnsafe(): T {
        if (this.size === 0) throw new Error("Cannot peek on an empty heap.");
        return this.data[0]!;
    }

    private heapify(): void {
        const size = this.size;
        for (let i = (size >>> 1) - 1; i >= 0; i--) {
            this.downHeap(i, size);
        }
    }

    clear(): void {
        this.size = 0;
    }

    toArray(): T[] {
        return this.data.slice(0, this.size);
    }

    toSortedArray(): T[] {
        // 1. 复制数组的有效部分
        const sorted = this.data.slice(0, this.size);

        // 2. 使用与堆相同的比较逻辑进行排序。
        sorted.sort(this.compare);

        // 3. 不再画蛇添足地反转，将排序结果直接返回
        return sorted;
    }
} 