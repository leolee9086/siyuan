import { createRouterClass } from '../../../src/util/zodMethodDefinedClass/method';
import z from 'zod';

describe('createRouterClass schema 验证类型测试', () => {
    it('应该能够验证 ctx schema', async () => {
        const methodNames = ['test'] as const;
        const ctxSchema = z.object({
            userId: z.string(),
            age: z.number().min(18)
        });
        
        const RouterClass = createRouterClass(methodNames, ctxSchema);
        const router = new RouterClass();
        
        // 正确的 ctx 应该通过验证
        await expect(
            router.test({ userId: 'user123', age: 25 }, {}, {})
        ).resolves.not.toThrow();
        
        // 错误的 ctx 应该抛出异常
        await expect(
            router.test({ userId: 'user123', age: 15 }, {}, {})
        ).rejects.toThrow();
        // 类型错误的ctx应该无法通过检查
        await expect(
            //@ts-expect-error
            router.test({ userId: 123, age: 25 }, {}, {})
        ).rejects.toThrow();
    });
    
    it('应该能够验证 inputs schema', async () => {
        const methodNames = ['process'] as const;
        const inputsSchema = z.object({
            data: z.string().min(5),
            count: z.number().positive()
        });
        
        const RouterClass = createRouterClass(methodNames, undefined, inputsSchema);
        const router = new RouterClass();
        
        // 正确的 inputs 应该通过验证
        await expect(
            router.process({}, { data: 'hello world', count: 5 }, {})
        ).resolves.not.toThrow();
        
        // 错误的 inputs 应该抛出异常
        await expect(
            router.process({}, { data: 'hi', count: 5 }, {})
        ).rejects.toThrow();
        
        await expect(
            router.process({}, { data: 'hello world', count: -1 }, {})
        ).rejects.toThrow();
    });
    
    it('应该能够验证 outputs schema', async () => {
        const methodNames = ['generate'] as const;
        const outputsSchema = z.object({
            result: z.string(),
            success: z.boolean()
        });
        
        const RouterClass = createRouterClass(methodNames, undefined, undefined, outputsSchema);
        const router = new RouterClass();
        
        // 正确的 outputs 应该通过验证
        await expect(
            router.generate({}, {}, { result: 'generated data', success: true })
        ).resolves.not.toThrow();
        
        // 错误的 outputs 应该抛出异常
        await expect(
             //@ts-expect-error
            router.generate({}, {}, { result: 123, success: true })
        ).rejects.toThrow();
        
        await expect(
            //@ts-expect-error
            router.generate({}, {}, { result: 'generated data', success: 'yes' })
        ).rejects.toThrow();
    });
    
    it('应该能够验证所有 schema 组合', async () => {
        const methodNames = ['complete'] as const;
        const ctxSchema = z.object({
            user: z.object({
                id: z.string(),
                role: z.enum(['admin', 'user'])
            })
        });
        
        const inputsSchema = z.object({
            action: z.string(),
            payload: z.record(z.any(),z.any())
        });
        
        const outputsSchema = z.object({
            status: z.enum(['success', 'error']),
            data: z.optional(z.any())
        });
        
        const RouterClass = createRouterClass(methodNames, ctxSchema, inputsSchema, outputsSchema);
        const router = new RouterClass();
        
        // 所有参数正确应该通过验证
        await expect(
            router.complete(
                { user: { id: 'user123', role: 'admin' } },
                { action: 'create', payload: { name: 'test' } },
                { status: 'success', data: { id: 'new123' } }
            )
        ).resolves.not.toThrow();
        
        // 任何一个参数错误都应该抛出异常
        await expect(
            router.complete(
                //@ts-expect-error
                { user: { id: 'user123', role: 'invalid' } }, // 错误的 role
                { action: 'create', payload: { name: 'test' } },
                { status: 'success', data: { id: 'new123' } }
            )
        ).rejects.toThrow();
        
        await expect(
            router.complete(
                { user: { id: 'user123', role: 'admin' } },
                //@ts-expect-error
                { action: 123, payload: { name: 'test' } }, // 错误的 action 类型
                { status: 'success', data: { id: 'new123' } }
            )
        ).rejects.toThrow();
        
        await expect(
            router.complete(
                { user: { id: 'user123', role: 'admin' } },
                { action: 'create', payload: { name: 'test' } },
                //@ts-expect-error
                { status: 'invalid', data: { id: 'new123' } } // 错误的 status
            )
        ).rejects.toThrow();
    });
    
    it('应该能够处理复杂嵌套 schema', async () => {
        const methodNames = ['complex'] as const;
        const complexSchema = z.object({
            level1: z.object({
                level2: z.object({
                    level3: z.object({
                        value: z.string().regex(/^[A-Z]+$/),
                        numbers: z.array(z.number()).min(3)
                    })
                })
            })
        });
        
        const RouterClass = createRouterClass(methodNames, complexSchema);
        const router = new RouterClass();
        
        // 正确的嵌套结构应该通过验证
        await expect(
            router.complex(
                {
                    level1: {
                        level2: {
                            level3: {
                                value: 'HELLO',
                                numbers: [1, 2, 3, 4, 5]
                            }
                        }
                    }
                },
                {},
                {}
            )
        ).resolves.not.toThrow();
        
        // 错误的嵌套结构应该抛出异常
        await expect(
            router.complex(
                {
                    level1: {
                        level2: {
                            level3: {
                                value: 'hello', // 不符合大写正则
                                numbers: [1, 2] // 数组长度不足
                            }
                        }
                    }
                },
                {},
                {}
            )
        ).rejects.toThrow();
    });
});