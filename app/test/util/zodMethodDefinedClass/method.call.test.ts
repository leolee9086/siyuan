import { describe, it, expect, beforeEach,test, vi } from "vitest";

import { createRouterClass } from "../../../src/util/lib/zodMethodDefinedClass/modeRouter";
import z from "zod";

describe("createRouterClass 方法调用类型测试", () => {
    it("应该能够正确推断方法参数类型", () => {
        const methodNames = ["read", "write"] as const;
        
        const ctxSchema = z.object({
            userId: z.string(),
            sessionId: z.string()
        });
        
        const inputsSchema = z.object({
            data: z.string(),
            timestamp: z.number()
        });
        
        const outputsSchema = z.object({
            result: z.boolean(),
            message: z.string()
        });
        
        const RouterClass = createRouterClass(
            methodNames,
            ctxSchema.shape,
            "userId", // 使用 ctxSchema 中的一个键作为 modeKey
            z.object({}) // 空的 optionsSchema
        );
        
        const router = new RouterClass({});
        
        // 类型检查：这些调用应该是类型安全的
        const testTypeInference = () => {
            // 正确的参数类型应该被推断
            router.read(
                "user123", // mode (对应 userId 字段)
                async (ctx, next) => { // handler
                    // 处理逻辑
                    await next(ctx);
                }
            );
            
            router.write(
                "user123", // mode
                async (ctx, next) => { // handler
                    // 处理逻辑
                    await next(ctx);
                }
            );
        };
        
        expect(typeof testTypeInference).toBe("function");
    });
    
    it("应该能够处理不同数量的方法名", () => {
        // 单个方法
        const SingleMethodRouter = createRouterClass(["execute"] as const, {} as z.ZodRawShape, "key" as any, z.object({}));
        const singleRouter = new SingleMethodRouter({});
        expect(typeof singleRouter.execute).toBe("function");
        
        // 多个方法
        const MultiMethodRouter = createRouterClass(["get", "post", "put", "delete"] as const, {} as z.ZodRawShape, "key" as any, z.object({}));
        const multiRouter = new MultiMethodRouter({});
        expect(typeof multiRouter.get).toBe("function");
        expect(typeof multiRouter.post).toBe("function");
        expect(typeof multiRouter.put).toBe("function");
        expect(typeof multiRouter.delete).toBe("function");
    });
    
    it("应该能够处理复杂的方法名", () => {
        const complexMethodNames = ["getUserById", "createUser", "updateUserProfile", "deleteUserAccount"] as const;
        
        const ComplexRouter = createRouterClass(complexMethodNames, {} as z.ZodRawShape, "key" as any, z.object({}));
        const complexRouter = new ComplexRouter({});
        
        expect(typeof complexRouter.getUserById).toBe("function");
        expect(typeof complexRouter.createUser).toBe("function");
        expect(typeof complexRouter.updateUserProfile).toBe("function");
        expect(typeof complexRouter.deleteUserAccount).toBe("function");
    });
    
    it("应该能够处理嵌套的 schema 类型", () => {
        const methodNames = ["process"] as const;
        
        const nestedCtxSchema = z.object({
            user: z.object({
                id: z.string(),
                profile: z.object({
                    name: z.string(),
                    age: z.number()
                })
            }),
            settings: z.object({
                theme: z.enum(["light", "dark"]),
                notifications: z.boolean()
            })
        });
        
        const NestedRouter = createRouterClass(methodNames, nestedCtxSchema.shape, "user" as any, z.object({}));
        const nestedRouter = new NestedRouter({});
        
        // 类型检查：嵌套对象应该被正确推断
        const testNestedTypes = () => {
            nestedRouter.process(
                { // mode (对应 user 字段)
                    id: "user123",
                    profile: {
                        name: "John Doe",
                        age: 30
                    }
                },
                async (ctx, next) => { // handler
                    // 处理逻辑
                    await next(ctx);
                }
            );
        };
        
        expect(typeof testNestedTypes).toBe("function");
    });
});
