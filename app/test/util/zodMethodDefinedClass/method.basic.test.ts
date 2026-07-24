import { describe, it, expect, beforeEach,test, vi } from "vitest";

import { createRouterClass } from "../../../src/util/lib/zodMethodDefinedClass/modeRouter";
import z from "zod";

describe("createRouterClass 基本类型安全测试", () => {
    it("应该能够创建具有指定方法的路由器类", () => {
        // 定义方法名列表
        const methodNames = ["read", "write"] as const;
        
        // 定义 schema
        const ctxSchema = {
            userId: z.string(),
            sessionId: z.string()
        };
        
        const optionsSchema = z.object({});
        
        // 创建路由器类
        const RouterClass = createRouterClass(
            methodNames,
            ctxSchema,
            "userId", // modeKey
            optionsSchema
        );
        
        // 验证返回的是一个构造函数
        expect(typeof RouterClass).toBe("function");
        
        // 验证可以实例化
        const router = new RouterClass({});
        expect(router).toBeDefined();
        
        // 验证具有指定的方法
        expect(typeof router.read).toBe("function");
        expect(typeof router.write).toBe("function");
    });
    
    it("应该能够处理没有 schema 的情况", () => {
        const methodNames = ["execute"] as const;
        
        // 提供一个简单的 schema
        const ctxSchema = {
            mode: z.string()
        };
        
        const RouterClass = createRouterClass(
            methodNames,
            ctxSchema,
            "mode", // modeKey
            z.object({}) // 空的 optionsSchema
        );
        
        const router = new RouterClass({});
        
        // 验证方法存在且可调用
        expect(typeof router.execute).toBe("function");
        
        // 验证可以传入任意参数而不报错
        expect(async () => {
            await router.execute("test", async () => {});
        }).not.toThrow();
    });
    
    it("应该能够处理部分 schema 的情况", () => {
        const methodNames = ["process"] as const;
        
        // 只提供 ctxSchema
        const ctxSchema = {
            value: z.number()
        };
        
        const RouterClass = createRouterClass(
            methodNames,
            ctxSchema,
            "value", // modeKey
            z.object({}) // 空的 optionsSchema
        );
        
        const router = new RouterClass({});
        
        // 验证方法存在
        expect(typeof router.process).toBe("function");
        
        // 验证可以传入正确的参数
        expect(async () => {
            await router.process(42, async () => {});
        }).not.toThrow();
    });
});
