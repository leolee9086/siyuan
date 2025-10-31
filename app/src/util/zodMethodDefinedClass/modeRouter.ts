import z, { keyof } from "zod"
import { deepEqual } from "./deepEqual";
import {
    MODE_MIDDLEWARE_FUNCTION,
    HANDLERMETHOD,
    RouterMethods,
    SCHEMA_TYPE_FROM_RAW
} from "./modeRouter.types";
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


// 路由器元方法类型定义
type RouterMetaMethods<
    CtxSchema extends z.ZodRawShape,
    ModeKey extends keyof z.infer<z.ZodObject<CtxSchema>>
> = {
    initRegisterMethods: () => void;
    route: (methodName: string, ctx: z.infer<z.ZodObject<CtxSchema>>) => Promise<void>;
    routes: (methodName: string, ctx: z.infer<z.ZodObject<CtxSchema>>) => Promise<MODE_MIDDLEWARE_FUNCTION<z.infer<z.ZodObject<CtxSchema>>>>;
    switcher: (methodName: string, switcher: ModeSwitcher<CtxSchema, z.infer<z.ZodObject<CtxSchema>>[ModeKey]>) => void;
    sort: (methodName: string, mode: z.infer<z.ZodObject<CtxSchema>>[ModeKey], sortFn?: (a: MODE_MIDDLEWARE_FUNCTION<z.infer<z.ZodObject<CtxSchema>>>, b: MODE_MIDDLEWARE_FUNCTION<z.infer<z.ZodObject<CtxSchema>>>) => number) => void;
};

// 路由器类类型定义
type RouterClass<
    MethodNames extends readonly string[],
    CtxSchema extends z.ZodRawShape,
    OptionsSchema extends z.ZodSchema = z.ZodSchema,
    ModeKey extends keyof z.infer<z.ZodObject<CtxSchema>> = keyof z.infer<z.ZodObject<CtxSchema>>,
> = new (options: z.infer<OptionsSchema>) => RouterMethods<MethodNames, CtxSchema, ModeKey> & RouterMetaMethods<CtxSchema, ModeKey>;

// 模式条目，包含模式值和对应的处理函数
interface ModeEntry<M, CTX> {
    mode: M;
    handlers: MODE_MIDDLEWARE_FUNCTION<CTX>[];
}


class Registry<M, CTX> {
    // 存储模式和处理函数的映射
    private modeEntries: Map<string, ModeEntry<M, CTX>> = new Map();

    // 添加处理函数到指定模式
    add(methodName: string, mode: M, handler: MODE_MIDDLEWARE_FUNCTION<CTX>): void {
        const key = `${methodName}:${JSON.stringify(mode)}`;
        const existingEntry = this.modeEntries.get(key);

        if (existingEntry) {
            existingEntry.handlers.push(handler);
        } else {
            this.modeEntries.set(key, {
                mode,
                handlers: [handler]
            });
        }
    }

    // 获取指定方法的处理函数列表
    get(methodName: string, mode: M): MODE_MIDDLEWARE_FUNCTION<CTX>[] {
        const key = `${methodName}:${JSON.stringify(mode)}`;
        const entry = this.modeEntries.get(key);
        return entry ? entry.handlers : [];
    }

    // 检查模式是否存在
    has(methodName: string, mode: M): boolean {
        const key = `${methodName}:${JSON.stringify(mode)}`;
        return this.modeEntries.has(key);
    }

    // 获取所有模式
    getAllModes(methodName: string): M[] {
        const modes: M[] = [];
        for (const [key, entry] of this.modeEntries) {
            if (key.startsWith(`${methodName}:`)) {
                modes.push(entry.mode);
            }
        }
        return modes;
    }

    // 清空注册表
    clear(): void {
        this.modeEntries.clear();
    }
}



class Stack<M, CTX> {
    // 存储模式和处理函数的列表，使用深度比对来查找匹配的模式
    // 注册表在注册函数时使用,栈在实际处理时使用
    private modeEntries: ModeEntry<M, CTX>[] = [];

    // 添加处理函数到指定模式
    add(mode: M, handler: MODE_MIDDLEWARE_FUNCTION<CTX>): void {
        const existingEntry = this.modeEntries.find(entry => deepEqual(entry.mode, mode));
        if (existingEntry) {
            existingEntry.handlers.push(handler);
        } else {
            this.modeEntries.push({ mode, handlers: [handler] });
        }
    }

    // 获取指定模式的处理函数列表
    get(mode: M): MODE_MIDDLEWARE_FUNCTION<CTX>[] {
        const entry = this.modeEntries.find(entry => deepEqual(entry.mode, mode));
        return entry ? entry.handlers : [];
    }

    // 检查模式是否存在
    has(mode: M): boolean {
        return this.modeEntries.some(entry => deepEqual(entry.mode, mode));
    }
}

// 模式切换器，用于根据当前状态决定下一个模式
interface ModeSwitcher<CtxSchema extends z.ZodRawShape, M> {
    // 根据当前上下文决定下一个模式
    switch: (
        ctx: z.infer<CtxSchema>,
        availableModes: M[]
    ) => M | null;
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
    const MethodNames extends readonly string[],
    CtxSchemaShape extends z.ZodRawShape,
    OptionsSchema extends z.ZodSchema,
        ModeKey extends keyof SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>
    
>(
    methodNames: MethodNames,
    ctxSchemaShape: CtxSchemaShape,
    modeKey: ModeKey,
    optionsSchema: OptionsSchema
) {


    // 路由器方法类型定义

    // 创建一个基础类
    class Router {
        private validatedOptions: z.infer<OptionsSchema>;
        private handlerStacks: Map<string, Stack<z.infer<z.ZodObject<CtxSchemaShape>>[typeof modeKey], z.infer<z.ZodObject<CtxSchemaShape>>>> = new Map();
        private modeSwitchers: Map<any, ModeSwitcher<CtxSchemaShape, z.infer<z.ZodObject<CtxSchemaShape>>[typeof modeKey]>> = new Map();
        private modeHandlers: Map<any, ModeSwitcher<CtxSchemaShape, z.infer<z.ZodObject<CtxSchemaShape>>[typeof modeKey]>> = new Map();
        // 为每个方法创建独立的注册表
        private methodRegistries: Map<string, Registry<z.infer<z.ZodObject<CtxSchemaShape>>[typeof modeKey], z.infer<z.ZodObject<CtxSchemaShape>>>> = new Map();

        private modeKey: keyof z.infer<z.ZodObject<CtxSchemaShape>>;
        constructor(options?: z.infer<OptionsSchema>) {
            // 如果提供了 optionsSchema，则校验 options 参数
            if (optionsSchema) {
                this.validatedOptions = optionsSchema.parse(options || {});
            } else {
                this.validatedOptions = options;
            }
            this.modeKey = modeKey;
            this.initRegisterMethods()
        }
        /**
         * 此方法用于注册,不应该调用route
         */
        initRegisterMethods() {
            // 为每个方法名创建一个方法
            for (const methodName of methodNames) {
                // 为每个方法名创建一个独立的注册表
                this.methodRegistries.set(methodName, new Registry<z.infer<z.ZodObject<CtxSchemaShape>>[typeof modeKey], z.infer<z.ZodObject<CtxSchemaShape>>>());
                // 处理栈在dispatch时才会构建

                (this as Record<string, unknown>)[methodName] = (
                    mode: z.infer<z.ZodObject<CtxSchemaShape>>[typeof modeKey],
                    handler: MODE_MIDDLEWARE_FUNCTION<z.infer<z.ZodObject<CtxSchemaShape>>>
                ): void => {
                    // 将handler注册到对应方法的注册表
                    const registry = this.methodRegistries.get(methodName);
                    if (registry) {
                        registry.add(methodName, mode, handler);
                    }
                };
            }
        }


        /**
         * 设置模式切换器，用于根据当前状态决定下一个模式
         */
        switcher(methodName: string, switcher: ModeSwitcher<CtxSchemaShape, z.infer<z.ZodObject<CtxSchemaShape>>[typeof modeKey]>): void {
            this.modeSwitchers.set(methodName, switcher);
        }
        /**
         * 此元方法用于执行方法的排序,传入排序标准,然后方法的执行顺序按照此标准根据方法本身和meta进行排序
         *
         */
        sort(
            methodName: string,
            mode: z.infer<z.ZodObject<CtxSchemaShape>>[typeof modeKey],
            sortFn?: (a: MODE_MIDDLEWARE_FUNCTION<z.infer<z.ZodObject<CtxSchemaShape>>>, b: MODE_MIDDLEWARE_FUNCTION<z.infer<z.ZodObject<CtxSchemaShape>>>) => number): void {
            const stack = this.handlerStacks.get(methodName);
            if (stack && stack.has(mode)) {
                const handlers = stack.get(mode);
                if (sortFn) {
                    handlers.sort(sortFn);
                }
            }
        }
        /**
         */
        async routes(methodName: string, ctx: z.infer<z.ZodObject<CtxSchemaShape>>):Promise <MODE_MIDDLEWARE_FUNCTION<z.infer<z.ZodObject<CtxSchemaShape>>>> {
            const dispatch = (ctx: z.infer<z.ZodObject<CtxSchemaShape>>, next: MODE_MIDDLEWARE_FUNCTION<z.infer<z.ZodObject<CtxSchemaShape>>>) => {
                // 从注册表获取handlers并构建处理栈
                const registry = this.methodRegistries.get(methodName);
                const stack = this.handlerStacks.get(methodName);
                const mode = ctx[this.modeKey];

                if (!registry) {
                    throw new Error(`No registry found for method ${methodName}`);
                }

                if (!stack) {
                    throw new Error(`No stack found for method ${methodName}`);
                }

                // 从注册表获取所有handlers
                const registryHandlers = registry.get(methodName, mode);

                if (registryHandlers.length === 0) {
                    throw new Error(`No handlers found for method ${methodName} with mode ${mode}`);
                }

                // 将注册表中的handlers添加到处理栈
                for (const handler of registryHandlers) {
                    stack.add(mode, handler);
                }

                const handlers = stack.get(mode);
                if (handlers.length === 0) {
                    return;
                }
                const ctxSchema = z.object(ctxSchemaShape);

                // 创建洋葱模型的执行链
                const executeChain = async (index: number): Promise<void> => {
                    if (index >= handlers.length) {
                        return; // 到达链的末尾
                    }

                    const currentHandler = handlers[index];
                    const next = () => executeChain(index + 1);

                    await (currentHandler as MODE_MIDDLEWARE_FUNCTION<typeof ctx>)(ctx, next);
                };

                // 开始执行链
                executeChain(0);
            };

            dispatch.router = this
            return dispatch
        }

        async route(methodName: string): Promise<void> {
        }
    }
 // 类型定义
    type RouterInstanceType = InstanceType<typeof Router> & {
        [K in MethodNames[number]]: (...args: any[]) => Promise<any>;
    };
    return Router as RouterClass<MethodNames, CtxSchemaShape, OptionsSchema>&RouterMethods<MethodNames, CtxSchemaShape, keyof z.infer<z.ZodObject<CtxSchemaShape>>> ;
}

const EventRouter = createRouterClass(['ctrl', 'click'], { test: z.string(), detail: z.object({c:z.string()}) }, 'detail', z.object())
let router= new EventRouter({

}).click('',(ctx,next)=>{
    next()
})