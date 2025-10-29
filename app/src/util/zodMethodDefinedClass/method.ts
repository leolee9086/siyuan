import z from "zod"

// 方法定义枚举
const methods = z.enum([
    'read','write'
])



// 方法配置类型，使用更严格的类型定义
type MethodConfig<
    CtxSchema extends z.ZodSchema = z.ZodAny,
    InputsSchema extends z.ZodSchema = z.ZodAny,
    OutputsSchema extends z.ZodSchema = z.ZodAny
> = {
    ctxSchema?: CtxSchema;
    inputsSchema?: InputsSchema;
    outputsSchema?: OutputsSchema;
}



/**
 * 实现一个实验性泛型方法,能够根据一个方法名列表和ctx,inputs,outputs的schema,创建router类,注意是类而不是类实例
 * 例如 const domainedRouter = createRouterClass(<方法名列表>,ctxSchema,inputsSchema,outputSchema)会返回一个类
 * 假如方法名列表为read,write
 * 此时可以类型安全地通过 new domainedRouter().read(ctx,inputs,outputs),new domainedRouter().write(ctx,inputs,outputs)来调用方法列表中的方法
 * 1.禁止使用any
 * 2.禁止使用类型断言
 * 3.禁止删除这些注释
 *
 */


// 路由器方法类型定义
type RouterMethod<
    CtxSchema extends z.ZodSchema,
    InputsSchema extends z.ZodSchema,
    OutputsSchema extends z.ZodSchema
> = (
    ctx: z.infer<CtxSchema>,
    inputs: z.infer<InputsSchema>,
    outputs: z.infer<OutputsSchema>
) => Promise<void> | void;

// 路由器类类型定义
type RouterClass<
    MethodNames extends string,
    CtxSchema extends z.ZodSchema,
    InputsSchema extends z.ZodSchema,
    OutputsSchema extends z.ZodSchema
> = new () => {
    [K in MethodNames]: RouterMethod<CtxSchema, InputsSchema, OutputsSchema>;
};

/**
 * 实现一个实验性泛型方法,能够根据一个方法名列表和ctx,inputs,outputs的schema,创建router类,注意是类而不是类实例
 * 例如 const DomainedRouter = createRouterClass(<方法名列表>,ctxSchema,inputsSchema,outputSchema)会返回一个类
 * 假如方法名列表为read,write
 * 此时可以类型安全地通过 new DomainedRouter().read(ctx,inputs,outputs),new DomainedRouter().write(ctx,inputs,outputs)来调用方法列表中的方法
 * @todo 需要实现路由特性
 * 路由特性如下:
 * 1.洋葱路由
 * 2.支持中间件,中间件会被类型检查
 * 3.根据以下模式匹配
 * 
 * 
 * 1.禁止使用any
 * 2.禁止使用类型断言
 * 3.禁止删除这些注释
 *
 */
export function createRouterClass<
    MethodNames extends readonly string[],
    CtxSchema extends z.ZodSchema = z.ZodAny,
    InputsSchema extends z.ZodSchema = z.ZodAny,
    OutputsSchema extends z.ZodSchema = z.ZodAny
>(
    methodNames: MethodNames,
    ctxSchema?: CtxSchema,
    inputsSchema?: InputsSchema,
    outputsSchema?: OutputsSchema
): RouterClass<MethodNames[number], CtxSchema, InputsSchema, OutputsSchema> {
    // 创建一个基础类
    class Router {
        constructor() {
            // 为每个方法名创建一个方法
            for (const methodName of methodNames) {
                (this as Record<string, unknown>)[methodName] = async (
                    ctx: z.infer<CtxSchema>,
                    inputs: z.infer<InputsSchema>,
                    outputs: z.infer<OutputsSchema>,
                    next:()=>Promise<void>
                ): Promise<void> => {
                    // 验证输入参数
                    if (ctxSchema) {
                        ctxSchema.parse(ctx);
                    }
                    if (inputsSchema) {
                        inputsSchema.parse(inputs);
                    }
                    if (outputsSchema) {
                        outputsSchema.parse(outputs);
                    }
                    
                    // 默认实现：什么都不做，等待子类覆盖
                    console.log(`调用方法: ${methodName}`, { ctx, inputs, outputs });
                };
            }
        }
        /**
         * 此元方法用于执行方法的实现,传入实现函数和meta
         * 例如router.$add(<方法名>,<实现方法>,meta)之后,实现方法就被加入到实现序列中
         */
        $add(){

        }
        /**
         * 此元方法用于执行方法的排序,传入排序标准,然后方法的执行顺序按照此标准根据方法本身和meta进行排序
         * 
         */
        $sort(){

        }
        /**
         * 此元方法用于执行,执行直接按照排序就可以
         */
        async $excute(){

        }
    }
    
    return Router as RouterClass<MethodNames[number], CtxSchema, InputsSchema, OutputsSchema>;
}

