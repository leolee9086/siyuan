import z from "zod";
import {
    MODE_MIDDLEWARE_FUNCTION,
    RouterMethods,
    SCHEMA_TYPE_FROM_RAW,
    RouterClass,
    ModeSwitcher,
    SortFn
} from "./modeRouter.types";
import { Registry, Stack, executeDispatchChain } from "./modeRouter.internal";
import { asRouterClass } from "./modeRouter.guard";

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

/**
 * 创建 Router 类内部的方法注册逻辑
 */
function 初始化方法注册<
    MethodNames extends readonly string[],
    CtxSchemaShape extends z.ZodRawShape,
    ModeKey extends keyof SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>,
    TRouter extends object
>(
    router: TRouter,
    methodNames: MethodNames,
    methodRegistries: Map<string, Registry<SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>[ModeKey], SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>>>,
    setter: (router: TRouter, methodName: string, fn: (mode: SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>[ModeKey], handler: MODE_MIDDLEWARE_FUNCTION<SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>>) => void) => void
): void {
    for (const methodName of methodNames) {
        methodRegistries.set(methodName, new Registry<SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>[ModeKey], SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>>());

        setter(
            router,
            methodName,
            (mode, handler) => {
                const registry = methodRegistries.get(methodName);
                if (registry) {
                    registry.add(methodName, mode, handler);
                }
            }
        );
    }
}

/**
 * 构建 dispatch 函数
 */
function 构建Dispatch<
    CtxSchemaShape extends z.ZodRawShape,
    ModeKey extends keyof SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>
>(
    methodName: string,
    modeKey: ModeKey,
    methodRegistries: Map<string, Registry<SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>[ModeKey], SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>>>,
    handlerStacks: Map<string, Stack<SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>[ModeKey], SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>>>
): (ctx: SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>) => void {
    return (ctx: SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>) => {
        const registry = methodRegistries.get(methodName);
        const stack = handlerStacks.get(methodName);
        const mode = ctx[modeKey];

        if (!registry) {
            throw new Error(`No registry found for method ${methodName}`);
        }
        if (!stack) {
            throw new Error(`No stack found for method ${methodName}`);
        }

        const registryHandlers = registry.get(methodName, mode);
        if (registryHandlers.length === 0) {
            throw new Error(`No handlers found for method ${methodName} with mode ${mode}`);
        }

        for (const handler of registryHandlers) {
            stack.add(mode, handler);
        }

        const handlers = stack.get(mode);
        if (handlers.length === 0) {
            return;
        }

        executeDispatchChain(handlers, ctx, 0);
    };
}


/**
 * Router 类字段设置器
 */
function routerFieldSetter(
    router: Record<string, unknown>,
    methodName: string,
    fn: unknown
): void {
    router[methodName] = fn;
}

/**
 * 创建 Router 类的内部实现
 * 分离出来以满足函数行数限制
 */
function 创建Router类实现<
    const MethodNames extends readonly string[],
    CtxSchemaShape extends z.ZodRawShape,
    OptionsSchema extends z.ZodSchema,
    ModeKey extends keyof SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>
>(methodNames: MethodNames, modeKey: ModeKey, optionsSchema: OptionsSchema) {
    return class Router {
        [key: string]: unknown;
        private validatedOptions: z.infer<OptionsSchema>;
        private handlerStacks = new Map<string, Stack<SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>[ModeKey], SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>>>();
        private modeSwitchers = new Map<string, ModeSwitcher<CtxSchemaShape, SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>[ModeKey]>>();
        private methodRegistries = new Map<string, Registry<SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>[ModeKey], SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>>>();
        private modeKey: ModeKey;

        constructor(options: z.infer<OptionsSchema>) {
            this.validatedOptions = optionsSchema.parse(options || {});
            this.modeKey = modeKey;
            初始化方法注册(this, methodNames, this.methodRegistries, routerFieldSetter);
        }

        switcher(name: string, sw: ModeSwitcher<CtxSchemaShape, SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>[ModeKey]>): void {
            this.modeSwitchers.set(name, sw);
        }

        sort(name: string, mode: SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>[ModeKey], fn?: SortFn<CtxSchemaShape>): void {
            const stack = this.handlerStacks.get(name);
            if (stack && stack.has(mode) && fn) {
                stack.get(mode).sort(fn);
            }
        }

        async routes(name: string, _ctx: SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>): Promise<MODE_MIDDLEWARE_FUNCTION<SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>>> {
            return Object.assign(构建Dispatch(name, this.modeKey, this.methodRegistries, this.handlerStacks), { router: this });
        }

        async route(_name: string): Promise<void> { }
        initRegisterMethods(): void { /* 方法注册在构造函数中已完成 */ }
    };
}

export function createRouterClass<
    const MethodNames extends readonly string[],
    CtxSchemaShape extends z.ZodRawShape,
    OptionsSchema extends z.ZodSchema,
    ModeKey extends keyof SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>
>(
    methodNames: MethodNames,
    _ctxSchemaShape: CtxSchemaShape,
    modeKey: ModeKey,
    optionsSchema: OptionsSchema
): RouterClass<MethodNames, CtxSchemaShape, OptionsSchema, ModeKey> & RouterMethods<MethodNames, CtxSchemaShape, ModeKey> {
    const Router = 创建Router类实现<MethodNames, CtxSchemaShape, OptionsSchema, ModeKey>(
        methodNames,
        modeKey,
        optionsSchema
    );
    return asRouterClass<MethodNames, CtxSchemaShape, OptionsSchema, ModeKey>(Router);
}
