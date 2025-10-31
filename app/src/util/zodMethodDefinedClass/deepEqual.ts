// 深度比对函数，用于比较两个值是否相等
export function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;

    if (a == null || b == null) return false;

    if (typeof a !== typeof b) return false;

    if (typeof a !== 'object') return false;

    if (Array.isArray(a) !== Array.isArray(b)) return false;

    if (Array.isArray(a)) {
        if (a.length !== (b as unknown[]).length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], (b as unknown[])[i])) return false;
        }
        return true;
    }

    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
    }

    return true;
}
