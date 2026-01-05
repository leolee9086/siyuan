/**
 * @file createSegmentTree.ts
 * @description 一个用于高效处理区间求和与单点更新的分段树实现。
 * 专门为瀑布流的 justified (两端对齐) 布局算法优化。
 */

/**
 * 分段树节点
 */
interface SegmentTreeNode {
    sum: number; // 区间内所有元素的和
}

/**
 * 分段树实例的公开API
 */
export interface SegmentTree {
    /**
     * 更新指定索引处的值
     * @param index - 要更新的数组元素的索引
     * @param value - 新的值
     */
    update: (index: number, value: number) => void;

    /**
     * 查询指定区间 [queryLeft, queryRight] 内所有元素的和
     * @param queryLeft - 查询区间的左边界（包含）
     * @param queryRight - 查询区间的右边界（包含）
     * @returns 区间和
     */
    query: (queryLeft: number, queryRight: number) => number;

    /**
     * 从指定索引开始，查找一个"断点"，使得从该索引到断点之间的元素总和最接近但不超过给定的目标值。
     * @param startIndex - 开始查找的索引
     * @param targetSum - 目标和
     * @returns 包含结束索引和实际总和的对象
     */
    findBreakpoint: (startIndex: number, targetSum: number) => { endIndex: number, sum: number };
}

/**
 * 创建并初始化一个分段树
 * @param inputArray - 用于构建树的初始数组
 * @returns 一个分段树实例
 */
export function createSegmentTree(inputArray: number[]): SegmentTree {
    const n = inputArray.length;
    const tree: SegmentTreeNode[] = Array(4 * n).fill(null).map(() => ({ sum: 0 }));

    // --- 内部辅助函数 ---

    const build = (nodeIndex: number, start: number, end: number) => {
        if (start === end) {
            tree[nodeIndex] = { sum: inputArray[start] };
            return;
        }
        const mid = Math.floor((start + end) / 2);
        const leftChildIndex = 2 * nodeIndex + 1;
        const rightChildIndex = 2 * nodeIndex + 2;
        build(leftChildIndex, start, mid);
        build(rightChildIndex, mid + 1, end);
        tree[nodeIndex].sum = tree[leftChildIndex].sum + tree[rightChildIndex].sum;
    };

    const updateRecursive = (nodeIndex: number, start: number, end: number, targetIndex: number, value: number) => {
        if (start === end) {
            tree[nodeIndex].sum = value;
            return;
        }
        const mid = Math.floor((start + end) / 2);
        const leftChildIndex = 2 * nodeIndex + 1;
        const rightChildIndex = 2 * nodeIndex + 2;
        if (targetIndex <= mid) {
            updateRecursive(leftChildIndex, start, mid, targetIndex, value);
        } else {
            updateRecursive(rightChildIndex, mid + 1, end, targetIndex, value);
        }
        tree[nodeIndex].sum = tree[leftChildIndex].sum + tree[rightChildIndex].sum;
    };

    const queryRecursive = (nodeIndex: number, start: number, end: number, queryLeft: number, queryRight: number): number => {
        if (queryLeft > end || queryRight < start) {
            return 0; // 区间不相交
        }
        if (queryLeft <= start && end <= queryRight) {
            return tree[nodeIndex].sum; // 当前节点区间完全包含在查询区间内
        }
        const mid = Math.floor((start + end) / 2);
        const leftChildIndex = 2 * nodeIndex + 1;
        const rightChildIndex = 2 * nodeIndex + 2;
        const leftSum = queryRecursive(leftChildIndex, start, mid, queryLeft, queryRight);
        const rightSum = queryRecursive(rightChildIndex, mid + 1, end, queryLeft, queryRight);
        return leftSum + rightSum;
    };
    
    // @织: 这是为 justified 布局算法特别优化的核心函数
    const findBreakpointRecursive = (nodeIndex: number, start: number, end: number, currentSum: number, targetSum: number): { index: number, sum: number } => {
        // 如果当前节点的和加上累计和都不够，说明可以全要了
        if (currentSum + tree[nodeIndex].sum <= targetSum) {
            return { index: end, sum: currentSum + tree[nodeIndex].sum };
        }
        // 如果已经是叶子节点，不能再分了，就返回上一个状态
        if (start === end) {
            return { index: start - 1, sum: currentSum };
        }

        const mid = Math.floor((start + end) / 2);
        const leftChildIndex = 2 * nodeIndex + 1;
        const rightChildIndex = 2 * nodeIndex + 2;

        // 先尝试在左子树中查找
        const leftChildSum = tree[leftChildIndex].sum;
        if (currentSum + leftChildSum <= targetSum) {
            // 左子树可以全部放下，递归到右子树继续查找
            return findBreakpointRecursive(rightChildIndex, mid + 1, end, currentSum + leftChildSum, targetSum);
        } else {
            // 左子树放不下，递归到左子树中查找断点
            return findBreakpointRecursive(leftChildIndex, start, mid, currentSum, targetSum);
        }
    };


    // --- 初始化 ---
    if (n > 0) {
        build(0, 0, n - 1);
    }

    // --- 公开 API ---
    return {
        update: (index: number, value: number) => {
            if (index < 0 || index >= n) {
return;
}
            inputArray[index] = value; // 保持原始数组同步
            updateRecursive(0, 0, n - 1, index, value);
        },
        query: (queryLeft: number, queryRight: number) => {
            if (queryLeft < 0 || queryRight >= n || queryLeft > queryRight) {
return 0;
}
            return queryRecursive(0, 0, n - 1, queryLeft, queryRight);
        },
        findBreakpoint: (startIndex: number, targetSum: number) => {
            if (startIndex < 0 || startIndex >= n) {
return { endIndex: startIndex - 1, sum: 0 };
}
            // @织: 这里的实现比我想象的要复杂，findBreakpointRecursive 只是一个雏形
            // @织: 一个更健壮的实现需要从 startIndex 开始遍历，不断用 query 查询来逼近目标
            let low = startIndex;
            let high = n - 1;
            let bestEndIndex = startIndex - 1;

            while(low <= high) {
                const mid = Math.floor((low + high) / 2);
                if (queryRecursive(0, 0, n - 1, startIndex, mid) <= targetSum) {
                    bestEndIndex = mid;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }
            
            const finalSum = bestEndIndex >= startIndex ? queryRecursive(0, 0, n-1, startIndex, bestEndIndex) : 0;

            return { endIndex: bestEndIndex, sum: finalSum };
        }
    };
} 