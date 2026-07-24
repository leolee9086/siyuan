import { describe, it, expect, beforeEach,test, vi } from "vitest";

import { z } from "zod";
import { createZodSchemaFromDeepRaw, ZodDeepRaw } from "../../../src/util/lib/zodMethodDefinedClass/deepRaw";

describe("createZodSchemaFromDeepRaw", () => {
  it("应该能够创建简单的对象schema", () => {
    const simpleConfig: ZodDeepRaw = {
      name: z.string(),
      age: z.number()
    };
    
    const schema = createZodSchemaFromDeepRaw(simpleConfig);
    
    expect(schema).toBeInstanceOf(z.ZodObject);
    
    const validData = { name: "test", age: 25 };
    const result = schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("应该能够创建嵌套对象schema", () => {
    const nestedConfig: ZodDeepRaw = {
      user: {
        profile: {
          name: z.string(),
          age: z.number()
        }
      }
    };
    
    const schema = createZodSchemaFromDeepRaw(nestedConfig);
    
    const validData = { user: { profile: { name: "test", age: 25 } } };
    const result = schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("应该能够处理混合的zod类型和嵌套对象", () => {
    const mixedConfig: ZodDeepRaw = {
      id: z.string(),
      profile: {
        name: z.string(),
        settings: {
          theme: z.enum(["light", "dark"]),
          notifications: z.boolean()
        }
      }
    };
    
    const schema = createZodSchemaFromDeepRaw(mixedConfig);
    const validData = {
      id: "123",
      profile: {
        name: "test",
        settings: {
          theme: "light" as const,
          notifications: true
        }
      }
    };
    const result = schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("应该能够处理数组类型", () => {
    const arrayConfig: ZodDeepRaw = {
      tags: z.array(z.string()),
      users: z.array(z.object({
        name: z.string(),
        age: z.number()
      }))
    };
    
    const schema = createZodSchemaFromDeepRaw(arrayConfig);
    
    const validData = {
      tags: ["tag1", "tag2"],
      users: [
        { name: "user1", age: 25 },
        { name: "user2", age: 30 }
      ]
    };
    const result = schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("应该能够处理record类型", () => {
    const recordConfig: ZodDeepRaw = {
      metadata: z.record(z.string(), z.any()),
      scores: z.record(z.string(), z.number())
    };
    
    const schema = createZodSchemaFromDeepRaw(recordConfig);
    
    const validData = {
      metadata: { key1: "value1", key2: 123 },
      scores: { math: 90, english: 85 }
    };
    const result = schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("应该能够处理可选字段", () => {
    const optionalConfig: ZodDeepRaw = {
      name: z.string(),
      age: z.number().optional(),
      email: z.string().optional()
    };
    
    const schema = createZodSchemaFromDeepRaw(optionalConfig);
    
    const validData1 = { name: "test" };
    const result1 = schema.safeParse(validData1);
    expect(result1.success).toBe(true);
    
    const validData2 = { name: "test", age: 25 };
    const result2 = schema.safeParse(validData2);
    expect(result2.success).toBe(true);
  });

  it("应该能够正确验证无效数据", () => {
    const config: ZodDeepRaw = {
      name: z.string(),
      age: z.number()
    };
    
    const schema = createZodSchemaFromDeepRaw(config);
    
    const invalidData = { name: 123, age: "not a number" };
    const result = schema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
