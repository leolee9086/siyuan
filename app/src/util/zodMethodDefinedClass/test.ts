import { z } from 'zod';

// 定义严格的 HTTP 方法约束
// 更灵活的方法名约束
const methodNamesSchema = z.array(
    z.string()
     .min(1)
     .max(15)
     .regex(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/, 'Method name must be valid identifier')
).min(1).max(50);

/**
 * 处理函数,用于注册路由,调用时将路由函数加入到对应的注册表(不是处理栈,处理栈在实际调用routes时生成)
 */
/**
 * 路由函数
 */
export type MODE_MIDDLEWARE_FUNCTION<C> = (
    ctx: C,
    next?: MODE_MIDDLEWARE_FUNCTION<C>
) => Promise<void> | void;


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

// 类型定义
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
interface HandlerConfig {
    validateParams?: z.ZodSchema<any>;
    middleware?: ((...args: any[]) => any)[];
    timeout?: number;
}
export function createAdvancedRouterClass<
    const MethodNames extends readonly string[],
    CtxSchema extends z.ZodRawShape,
    ModeKey extends keyof SCHEMA_TYPE_FROM_RAW<CtxSchema>
>(
    methodNames: MethodNames,
    ctxSchema: CtxSchema,
    modeKey: ModeKey,
    handlerConfigs?: Partial<Record<MethodNames[number], HandlerConfig>>
) {
    const validatedMethods = methodNamesSchema.parse(methodNames);
    
    // 创建类
    const RouterClass = class {
         context: any;
         handlers: Map<string, Function> = new Map();
        
        constructor(initialContext?: any) {
            this.context = initialContext || {};
            
            // 为每个方法创建处理器
            for (const method of validatedMethods) {
                const config = handlerConfigs?.[method as keyof typeof handlerConfigs];
                const handler = this.createMethodHandler(method, config);
                
                // 添加到实例
                (this as any)[method] = handler;
                this.handlers.set(method, handler);
            }
        }
        
         createMethodHandler(method: string, config?: HandlerConfig): Function {
            return async (...args: any[]) => {
                try {
                    // 参数验证
                    if (config?.validateParams) {
                        const validatedArgs = config.validateParams.parse(args);
                        args = Array.isArray(validatedArgs) ? validatedArgs : [validatedArgs];
                    }
                    
                    // 执行中间件
                    if (config?.middleware) {
                        for (const middleware of config.middleware) {
                            await middleware(...args);
                        }
                    }
                    
                    // 超时控制
                    if (config?.timeout) {
                        return await Promise.race([
                            this.executeHandler(method, args),
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error(`Timeout after ${config.timeout}ms`)), config.timeout)
                            )
                        ]);
                    }
                    
                    return await this.executeHandler(method, args);
                    
                } catch (error) {
                    this.handleError(method, error, args);
                    throw error;
                }
            };
        }
        
         async executeHandler(method: string, args: any[]) {
            // 这里可以调用具体的业务逻辑
            // 在实际应用中，你可能会有一个路由表或插件系统
            return {
                method,
                args,
                context: this.context,
                mode: modeKey,
                timestamp: Date.now()
            };
        }
        
         handleError(method: string, error: any, args: any[]) {
            console.error(`Error in ${method}:`, error, 'Args:', args);
        }
        
        // 公共方法
        setContext(newContext: any) {
            this.context = { ...this.context, ...newContext };
            return this;
        }
        
        getMethodNames(): string[] {
            return [...validatedMethods];
        }
        
        hasMethod(method: string): method is MethodNames[number] {
            return validatedMethods.includes(method);
        }
    };
    
    // 类型定义
    type RouterInstanceType = InstanceType<typeof RouterClass> & {
        [K in MethodNames[number]]: (...args: any[]) => Promise<any>;
    };
    
    return RouterClass as new (initialContext?: any) => RouterInstanceType;
}
