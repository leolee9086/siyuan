
export class BinaryHeap {
    private data: number[];
    private size: number;

    constructor(data: number[] = []) {
        this.data = data.slice(); // 创建副本避免外部修改
        this.size = this.data.length;

        if (this.size > 0) {
            this.heapify();
        }
    }

    get length(): number {
        return this.size;
    }

    /**
     * 插入元素 - 优化版本
     */
    push(item: number): void {
        const data = this.data;
        const pos = this.size++;
        
        data[pos] = item;
        this.upHeap(pos, data);
    }

    /**
     * 批量插入 - 保持V1简洁性的高效实现
     */
    pushBulk(items: number[]): void {
        if (items.length === 0) return;

        // 预分配空间避免多次扩容
        const currentSize = this.size;
        const newSize = currentSize + items.length;
        
        // 确保数组有足够容量
        if (newSize > this.data.length) {
            const newCapacity = Math.max(newSize, this.data.length * 2);
            const newData = new Array(newCapacity);
            for (let i = 0; i < currentSize; i++) {
                newData[i] = this.data[i]!;
            }
            this.data = newData;
        }

        // 批量策略：根据数据量选择最优方法
        if (items.length < currentSize / 8) {
            // 小批量：逐个插入（保持V1的单操作优势）
            for (const item of items) {
                this.push(item);
            }
        } else {
            // 大批量：直接追加 + heapify（类似构造函数的策略）
            for (let i = 0; i < items.length; i++) {
                this.data[currentSize + i] = items[i]!;
            }
            this.size = newSize;
            this.heapify();
        }
    }

    /**
     * 提取最小值 - 优化版本
     */
    pop(): number | undefined {
        const size = this.size;
        if (size === 0) return undefined;

        const data = this.data;
        const top = data[0]!;
        
        const newSize = size - 1;
        this.size = newSize;
        
        if (newSize > 0) {
            data[0] = data[newSize]!;
            this.downHeap(0, data, newSize);
        }

        return top;
    }

    /**
     * 查看最小值
     */
    peek(): number | undefined {
        return this.data[0];
    }

    /**
     * 批量创建堆 - Floyd 算法优化版本
     */
    private heapify(): void {
        const data = this.data;
        const size = this.size;
        
        // 从最后一个非叶子节点开始
        for (let i = (size >>> 1) - 1; i >= 0; i--) {
            this.downHeap(i, data, size);
        }
    }

    /**
     * 上浮操作 - 激进优化版本
     */
    private upHeap(pos: number, data: number[]): void {
        const item = data[pos]!;
        
        // 展开循环的前几次迭代，减少分支开销
        if (pos > 0) {
            const parent = (pos - 1) >>> 1;
            const parentValue = data[parent]!;
            if (item < parentValue) {
                data[pos] = parentValue;
                pos = parent;
                
                // 继续向上
                while (pos > 0) {
                    const nextParent = (pos - 1) >>> 1;
                    const nextParentValue = data[nextParent]!;
                    if (item >= nextParentValue) break;
                    
                    data[pos] = nextParentValue;
                    pos = nextParent;
                }
            }
        }
        
        data[pos] = item;
    }

    /**
     * 下沉操作 - 超级优化版本
     */
    private downHeap(pos: number, data: number[], size: number): void {
        const halfLength = size >>> 1;
        const item = data[pos]!;
        
        while (pos < halfLength) {
            let bestChild = (pos << 1) + 1; // 左子节点
            let bestValue = data[bestChild]!;
            const rightChild = bestChild + 1;
            
            // 优化：先检查右子节点是否存在，再比较值
            if (rightChild < size) {
                const rightValue = data[rightChild]!;
                if (rightValue < bestValue) {
                    bestChild = rightChild;
                    bestValue = rightValue;
                }
            }
            
            // 如果当前项已经小于等于最佳子节点，结束
            if (item <= bestValue) break;
            
            data[pos] = bestValue;
            pos = bestChild;
        }
        
        data[pos] = item;
    }

    /**
     * 检查堆的有效性（调试用）
     */
    isValid(): boolean {
        const data = this.data;
        const size = this.size;
        
        for (let i = 0; i < (size >>> 1); i++) {
            const left = (i << 1) + 1;
            const right = left + 1;
            
            if (left < size && data[i]! > data[left]!) return false;
            if (right < size && data[i]! > data[right]!) return false;
        }
        
        return true;
    }

    /**
     * 转换为数组（调试用）
     */
    toArray(): number[] {
        const result: number[] = [];
        const tempHeap = new BinaryHeap(this.data.slice(0, this.size));
        
        while (tempHeap.length > 0) {
            result.push(tempHeap.pop()!);
        }
        
        return result;
    }

    /**
     * 清空堆
     */
    clear(): void {
        this.size = 0;
    }
}

/**
 * 泛型版本 - 支持自定义比较函数，但性能稍低
 */
export class BinaryHeapGeneric<T> {
    private data: T[];
    private size: number;
    private compare: (a: T, b: T) => number;

    constructor(data: T[] = [], compare: (a: T, b: T) => number = defaultCompare) {
        this.data = data.slice();
        this.size = this.data.length;
        this.compare = compare;

        if (this.size > 0) {
            this.heapify();
        }
    }

    get length(): number {
        return this.size;
    }

    push(item: T): void {
        const data = this.data;
        const pos = this.size++;
        
        data[pos] = item;
        this.upHeap(pos, data);
    }

    /**
     * 批量插入 - 泛型版本的高效实现
     */
    pushBulk(items: T[]): void {
        if (items.length === 0) return;

        // 预分配空间避免多次扩容
        const currentSize = this.size;
        const newSize = currentSize + items.length;
        
        // 确保数组有足够容量
        if (newSize > this.data.length) {
            const newCapacity = Math.max(newSize, this.data.length * 2);
            const newData = new Array<T>(newCapacity);
            for (let i = 0; i < currentSize; i++) {
                newData[i] = this.data[i]!;
            }
            this.data = newData;
        }

        // 批量策略：根据数据量选择最优方法
        if (items.length < currentSize / 8) {
            // 小批量：逐个插入（利用单操作优势）
            for (const item of items) {
                this.push(item);
            }
        } else {
            // 大批量：直接追加 + heapify
            for (let i = 0; i < items.length; i++) {
                this.data[currentSize + i] = items[i]!;
            }
            this.size = newSize;
            this.heapify();
        }
    }

    pop(): T | undefined {
        const size = this.size;
        if (size === 0) return undefined;

        const data = this.data;
        const top = data[0]!;
        
        const newSize = size - 1;
        this.size = newSize;
        
        if (newSize > 0) {
            data[0] = data[newSize]!;
            this.downHeap(0, data, newSize);
        }

        return top;
    }

    peek(): T | undefined {
        return this.data[0];
    }

    private heapify(): void {
        const data = this.data;
        const size = this.size;
        
        for (let i = (size >>> 1) - 1; i >= 0; i--) {
            this.downHeap(i, data, size);
        }
    }

    private upHeap(pos: number, data: T[]): void {
        const item = data[pos]!;
        const compare = this.compare;
        
        while (pos > 0) {
            const parent = (pos - 1) >>> 1;
            const parentValue = data[parent]!;
            if (compare(item, parentValue) >= 0) break;
            
            data[pos] = parentValue;
            pos = parent;
        }
        
        data[pos] = item;
    }

    private downHeap(pos: number, data: T[], size: number): void {
        const halfLength = size >>> 1;
        const item = data[pos]!;
        const compare = this.compare;
        
        while (pos < halfLength) {
            let bestChild = (pos << 1) + 1;
            let bestValue = data[bestChild]!;
            const rightChild = bestChild + 1;
            
            if (rightChild < size && compare(data[rightChild]!, bestValue) < 0) {
                bestChild = rightChild;
                bestValue = data[rightChild]!;
            }
            
            if (compare(item, bestValue) <= 0) break;
            
            data[pos] = bestValue;
            pos = bestChild;
        }
        
        data[pos] = item;
    }
}

function defaultCompare<T>(a: T, b: T): number {
    return a < b ? -1 : a > b ? 1 : 0;
} 