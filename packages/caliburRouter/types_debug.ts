/**
 * 验证改进的类型重叠检测逻辑
 */

// 1. 原始的检测逻辑（有问题的）
type OriginalCheck<A, B> = [A & B] extends [never] ? false : true;

type A = { a: true };
type B = { a: false };
type Intersection = A & B; // { a: never }

// 期望: false (无交集)
// 实际: true (因为 {a:never} != never)
type ResultOriginal = OriginalCheck<A, B>;

// 2. 改进的逻辑：递归检测 never
type IsNever<T> = [T] extends [never] ? true : false;

// 检查对象中是否包含 never 属性 (浅层)
type HasNeverProperty<T> = {
    [K in keyof T]: IsNever<T[K]> extends true ? true : never
}[keyof T] extends never ? false : true;

// 我们的案例：
type Test1 = HasNeverProperty<{ a: never }>; // true
type Test2 = HasNeverProperty<{ a: string }>; // false

// 但我们需要递归检查，因为可能是 { a: { b: never } }
// 还有，交集可能会产生 { a: boolean } & { a: true } -> { a: true }，这是正常的
// 只有当属性类型变成了 never 才是问题。

// 深度检查是否包含 never
// 注意：这比较复杂，因为 A & B 可能会产生非常复杂的类型
// 也许我们只需要检查该类型是否"可实例化"？

// 另一种思路：利用 arktype 的行为。arktype 在 compute intersection 时，如果发现属性是 never，会把整个 intersection 标记为 unsatisfiable (抛错)。
// 在 TypeScript 类型层面，我们能做类似的事情吗？

// 让我们尝试定义一个 DeepNeverCheck
type DeepHasNever<T> = T extends object
    ? { [K in keyof T]: DeepHasNever<T[K]> }[keyof T]
    : IsNever<T>;

// DeepHasNever<{a: never}> -> true
// DeepHasNever<{a: {b: never}}> -> true
// DeepHasNever<{a: string}> -> false (实际上是 boolean | false -> boolean)

// 让我们完善它：我们希望只要发现一个 true 就返回 true
type ContainsNever<T> = T extends object
    ? { [K in keyof T]: ContainsNever<T[K]> }[keyof T] extends false ? false : true
    : IsNever<T>;

// 验证
type Case1 = ContainsNever<{ a: never }>; // true
type Case2 = ContainsNever<{ a: { b: never } }>; // true
type Case3 = ContainsNever<{ a: string }>; // false
type Case4 = ContainsNever<{ a: true } & { a: false }>; // true (因为结果是 {a: never})

// 还需要处理联合类型？
// 如果 T 是 A | B，只要其中一个是 never... 不，如果不匹配 A 但匹配 B，那还是有交集。
// 所以对于联合类型，只有当所有分支都包含 never 时... 不对。
// A & B 的结果如果是联合类型，说明有多种重叠可能。
// 如果结果是 {a: never}，那肯定没重叠。

console.log("此文件仅用于类型验证思考，不运行输出");
