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