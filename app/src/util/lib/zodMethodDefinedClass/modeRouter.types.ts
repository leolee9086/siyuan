import z from "zod";

/**
 * 路由函数
 */
export type MODE_MIDDLEWARE_FUNCTION<C> = (
    ctx: C,
    next?: MODE_MIDDLEWARE_FUNCTION<C>
) => Promise<void> | void;


/**
 * 处理函数,用于注册路由,调用时将路由函数加入到对应的注册表(不是处理栈,处理栈在实际调用routes时生成)
 */
export type HANDLERMETHOD<
    MODE,
    CTX
> = (
    mode: MODE,
    handler: MODE_MIDDLEWARE_FUNCTION<CTX>
) => void;

//从schema构建的定义
export type TYPE_FROM_SCHEMA<SCHEMA extends z.ZodSchema> = z.infer<SCHEMA>

//从rawShape构建的zod类型定义
export type SCHEMA_TYPE_FROM_RAW<RAW_SHAPE extends z.ZodRawShape> = TYPE_FROM_SCHEMA<z.ZodObject<RAW_SHAPE>>

/**
 * 排序函数类型
 */
export type SortFn<CtxSchema extends z.ZodRawShape> = (
    a: MODE_MIDDLEWARE_FUNCTION<SCHEMA_TYPE_FROM_RAW<CtxSchema>>,
    b: MODE_MIDDLEWARE_FUNCTION<SCHEMA_TYPE_FROM_RAW<CtxSchema>>
) => number;


// 路由器方法类型定义
export type RouterMethods<
    MethodNames extends readonly string[],
    CtxSchema extends z.ZodRawShape,
    ModeKey extends keyof SCHEMA_TYPE_FROM_RAW<CtxSchema>
> = {
        [K in MethodNames[number]]: HANDLERMETHOD<
            SCHEMA_TYPE_FROM_RAW<CtxSchema>[ModeKey],
            SCHEMA_TYPE_FROM_RAW<CtxSchema>
        >;
    };

// 模式切换器，用于根据当前状态决定下一个模式
export interface ModeSwitcher<CtxSchema extends z.ZodRawShape, M> {
    // 根据当前上下文决定下一个模式
    switch: (
        ctx: SCHEMA_TYPE_FROM_RAW<CtxSchema>,
        availableModes: M[]
    ) => M | null;
}

// 路由器元方法类型定义
export type RouterMetaMethods<
    CtxSchema extends z.ZodRawShape,
    ModeKey extends keyof SCHEMA_TYPE_FROM_RAW<CtxSchema>
> = {
    initRegisterMethods: () => void;
    route: (methodName: string, ctx: SCHEMA_TYPE_FROM_RAW<CtxSchema>) => Promise<void>;
    routes: (methodName: string, ctx: SCHEMA_TYPE_FROM_RAW<CtxSchema>) => Promise<MODE_MIDDLEWARE_FUNCTION<SCHEMA_TYPE_FROM_RAW<CtxSchema>>>;
    switcher: (methodName: string, switcher: ModeSwitcher<CtxSchema, SCHEMA_TYPE_FROM_RAW<CtxSchema>[ModeKey]>) => void;
    sort: (methodName: string, mode: SCHEMA_TYPE_FROM_RAW<CtxSchema>[ModeKey], sortFn?: (a: MODE_MIDDLEWARE_FUNCTION<SCHEMA_TYPE_FROM_RAW<CtxSchema>>, b: MODE_MIDDLEWARE_FUNCTION<SCHEMA_TYPE_FROM_RAW<CtxSchema>>) => number) => void;
};

// 路由器类类型定义
export type RouterClass<
    MethodNames extends readonly string[],
    CtxSchema extends z.ZodRawShape,
    OptionsSchema extends z.ZodSchema = z.ZodSchema,
    ModeKey extends keyof SCHEMA_TYPE_FROM_RAW<CtxSchema> = keyof SCHEMA_TYPE_FROM_RAW<CtxSchema>,
> = new (options: z.infer<OptionsSchema>) => RouterMethods<MethodNames, CtxSchema, ModeKey> & RouterMetaMethods<CtxSchema, ModeKey>;

// 模式条目，包含模式值和对应的处理函数
export interface ModeEntry<M, CTX> {
    mode: M;
    handlers: MODE_MIDDLEWARE_FUNCTION<CTX>[];
}