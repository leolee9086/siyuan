import z, { keyof } from "zod"


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


type RouterMethod<
    M,
    C> = (
        mode: M,
        ctx: C,
        next?: RouterMethod<M, C>
    ) => Promise<void> | void;


// 路由器类类型定义
type RouterClass<
    MethodNames extends string,
    CtxSchema extends z.ZodRawShape,
    OptionsSchema extends z.ZodSchema = z.ZodSchema,
    ModeKey extends keyof z.infer<z.ZodObject<CtxSchema>> = keyof z.infer<z.ZodObject<CtxSchema>>,
> = new (options: z.infer<OptionsSchema>) => {
    [K in MethodNames]: RouterMethod<z.infer<z.ZodObject<CtxSchema>>[ModeKey], z.infer<z.ZodObject<CtxSchema>>>;
};

class Stack {
    // 存储模式和处理函数的映射
    private modeHandlers: Map<any, Function[]> = new Map();

    // 添加处理函数到指定模式
    add(mode: string, handler: Function): void {
        if (!this.modeHandlers.has(mode)) {
            this.modeHandlers.set(mode, []);
        }
        this.modeHandlers.get(mode)!.push(handler);
    }

    // 获取指定模式的处理函数列表
    get(mode: string): Function[] {
        return this.modeHandlers.get(mode) || [];
    }

    // 检查模式是否存在
    has(mode: string): boolean {
        return this.modeHandlers.has(mode);
    }
}

// 模式切换器，用于根据当前状态决定下一个模式
interface ModeSwitcher<CtxSchema extends z.ZodRawShape> {
    // 根据当前上下文决定下一个模式
    switch: (
        ctx: z.infer<CtxSchema>,
        availableModes: string[]
    ) => string | null;
}
/**
 * 实现一个实验性泛型方法,能够根据一个方法名列表和ctx,inputs,outputs的schema,创建router类,注意是类而不是类实例
 * 例如 const DomainedRouter = createRouterClass(<方法名列表>,ctxSchema,inputsSchema,outputSchema)会返回一个类
 * 假如方法名列表为read,write
 * 此时可以类型安全地通过 new DomainedRouter().read(ctx),new DomainedRouter().write(ctx)来调用方法列表中的方法
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
    CtxSchemaShape extends z.ZodRawShape,
    OptionsSchema extends z.ZodSchema,
>(
    methodNames: MethodNames,
    ctxSchemaShape: CtxSchemaShape,
    modeKey: keyof z.infer<z.ZodObject<CtxSchemaShape>>,
    optionsSchema: OptionsSchema
): RouterClass<MethodNames[number], CtxSchemaShape, OptionsSchema> {

    const ctxSchema = z.object(ctxSchemaShape)
    type CTX = z.infer<typeof ctxSchema>;
    type MODE = z.infer<typeof ctxSchema>[typeof modeKey]
    // 路由器方法类型定义

    // 创建一个基础类
    class Router {
        private validatedOptions: z.infer<OptionsSchema>;
        private handlerStacks: Map<string, Stack> = new Map();
        private modeSwitchers: Map<any, ModeSwitcher<CtxSchemaShape>> = new Map();
        private modeKey: keyof z.infer<z.ZodObject<CtxSchemaShape>>;
        constructor(options?: z.infer<OptionsSchema>) {
            // 如果提供了 optionsSchema，则校验 options 参数
            if (optionsSchema) {
                this.validatedOptions = optionsSchema.parse(options || {});
            } else {
                this.validatedOptions = options;
            }
            this.modeKey = modeKey;
            this.$register()
        }

        $register() {
            // 为每个方法名创建一个方法
            for (const methodName of methodNames) {
                // 为每个方法名创建一个处理栈
                this.handlerStacks.set(methodName, new Stack());

                (this as Record<string, unknown>)[methodName] = async (
                    ctx: CTX
                ): Promise<void> => {
                    await this.$route(methodName, ctx);
                };
            }
        }
        /**
         * 此元方法用于执行方法的实现,传入实现函数和meta
         * 例如router.$add(<方法名>,<模式>,<实现方法>)之后,实现方法就被加入到实现序列中
         */
        $add(methodName: string, mode: string, handler: RouterMethod<CTX, MODE>): void {
            const stack = this.handlerStacks.get(methodName);
            if (stack) {
                stack.add(mode, handler);
            }
        }

        /**
         * 设置模式切换器，用于根据当前状态决定下一个模式
         */
        $switcher(methodName: string, switcher: ModeSwitcher<CtxSchemaShape>): void {
            this.modeSwitchers.set(methodName, switcher);
        }
        /**
         * 此元方法用于执行方法的排序,传入排序标准,然后方法的执行顺序按照此标准根据方法本身和meta进行排序
         *
         */
        $sort(methodName: string, mode: string, sortFn?: (a: RouterMethod<CTX, MODE>, b: RouterMethod<CTX, MODE>) => number): void {
            const stack = this.handlerStacks.get(methodName);
            if (stack && stack.has(mode)) {
                const handlers = stack.get(mode);
                if (sortFn) {
                    handlers.sort(sortFn);
                }
            }
        }
        /**
         * 此元方法用于执行,执行直接按照排序就可以
         * 执行的方式是这样:
         * 从最前方的开始执行,将下一个作为next传递给实际执行函数
         * 如果执行到最后一个,就反转过来,将上一个作为next传递给实际执行函数
         * "最后一个"的意思是,next没有被调用
         */
        async $route(methodName: string, ctx: CTX): Promise<void> {
              const stack = this.handlerStacks.get(methodName);
              const mode = ctx[this.modeKey]
              if (!stack || !stack.has(mode)) {
                  throw new Error(`No handlers found for method ${methodName} with mode ${mode}`);
              }
  
              const handlers = stack.get(mode);
              if (handlers.length === 0) {
                  return;
              }
  
              // 创建洋葱模型的执行链
              const executeChain = async (index: number): Promise<void> => {
                  if (index >= handlers.length) {
                      return; // 到达链的末尾
                  }
  
                  const currentHandler = handlers[index];
                  const next = () => executeChain(index + 1);
  
                  await currentHandler(mode, ctx, next);
              };
  
              // 开始执行链
              await executeChain(0);
        }
    }

    return Router as RouterClass<MethodNames[number], CtxSchemaShape, OptionsSchema>;
}
/**
 * 简单示例
 */
const Router = createRouterClass(['read'], { user: z.string() }, 'user', z.object({ a: z.string() }))
new Router({ a: "111" }).read("",{user:""})