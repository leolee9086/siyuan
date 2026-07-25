/** 严格比较两个类型，供独立契约校验文件使用。 */
export type StrictEqual<A, B> =
    (<T>() => T extends A ? 1 : 2) extends
    (<T>() => T extends B ? 1 : 2)
        ? true
        : false;

/** 检查具体实现是否覆盖外部契约，允许实现拥有额外内部成员。 */
export type IsAssignable<Implementation, Contract> =
    [Implementation] extends [Contract] ? true : false;

/** 当两个类型严格相等时返回原类型，否则返回指定错误类型。 */
export type AssertStrictEqual<A, B, ErrorMessage = never> =
    StrictEqual<A, B> extends true ? A : ErrorMessage;

/** 可用于提取实例类型的类构造函数。 */
type Constructor = abstract new (...args: never[]) => object;

/** 检查具体类实例是否严格满足领域契约。 */
export type InstanceLooksLike<Ctor extends Constructor, Contract> =
    StrictEqual<InstanceType<Ctor>, Contract>;

/** 提取 class 实例可由外部访问的完整公共表面，排除 private/protected 实现细节。 */
export type PublicInstance<Ctor extends Constructor> =
    Pick<InstanceType<Ctor>, keyof InstanceType<Ctor>>;

/** 严格校验领域契约与 class 的完整公共实例表面双向相等。 */
export type PublicInstanceLooksLike<Ctor extends Constructor, Contract> =
    StrictEqual<PublicInstance<Ctor>, Contract>;

/** 检查具体类的静态部分是否严格满足领域契约。 */
export type StaticLooksLike<Ctor extends Constructor, Contract> =
    StrictEqual<Ctor, Contract>;

/** 当具体类实例满足契约时保留构造器，否则返回 never。 */
export type ClassIfLooksLike<Ctor extends Constructor, Contract> =
    InstanceLooksLike<Ctor, Contract> extends true ? Ctor : never;
