import { z } from "zod";

export type ZodDeepRaw = {
  [key: string]: z.ZodTypeAny | ZodDeepRaw;
};

type ToZodObject<T extends ZodDeepRaw> = z.ZodObject<{
  [K in keyof T]: T[K] extends z.ZodTypeAny 
    ? T[K] 
    : T[K] extends ZodDeepRaw 
      ? ToZodObject<T[K]>
      : never;
}>;
// 子模式泛型 - 表示 T 的任意子集
export type ZodDeepRawSubset<T extends ZodDeepRaw> = {
  [K in keyof T]?: T[K] extends z.ZodTypeAny 
    ? z.ZodTypeAny  // 允许使用任何 Zod 类型，不一定是原来的类型
    : T[K] extends ZodDeepRaw 
      ? ZodDeepRawSubset<T[K]>  // 递归应用子模式
      : never;
};
// 严格子模式泛型 - 表示 T 的任意子集，但值必须与 T 相同
export type StrictZodDeepRawSubset<T extends ZodDeepRaw> = {
  [K in keyof T]?: T[K] extends z.ZodTypeAny 
    ? T[K]  // 必须使用相同的Zod类型
    : T[K] extends ZodDeepRaw 
      ? StrictZodDeepRawSubset<T[K]>  // 递归严格子模式
      : never;
};

const fullSchema = {
  name: z.string(),
  age: z.number(),
  address: {
    street: z.string(),
    city: z.string(),
    country: z.string(),
  },
  preferences: {
    theme: z.enum(["light", "dark"]),
    notifications: z.boolean(),
  },
};
const looseSubset: ZodDeepRawSubset<typeof fullSchema> = {
  name: z.string(), // 允许，但也可以使用z.any()等，不一定与完整模式相同
  address: {
    city: z.number(), // 允许
  },
};


export function createZodSchemaFromDeepRaw<T extends ZodDeepRaw>(config: T): ToZodObject<T> {
  const shape: any = {};
  
  for (const key in config) {
    const value = config[key];
    if (value && typeof value === "object" && !(value instanceof z.ZodType)) {
      shape[key] = createZodSchemaFromDeepRaw(value );
    } else {
      shape[key] = value;
    }
  }
  
  return z.object(shape) as ToZodObject<T>;
}

/**
 * 检查一个 ZodDeepRaw 是否是另一个 ZodDeepRaw 的子模式
 * 只检查形状结构，不检查具体类型
 */
export function isSubschemaOf<T extends ZodDeepRaw>(
  potentialSubschema: T,
  potentialSuperschema: T
): boolean {
  // 遍历子模式的所有键
  for (const key in potentialSubschema) {
    // 如果父模式中没有这个键，则不是子模式
    if (!(key in potentialSuperschema)) {
      return false;
    }

    const subschemaValue = potentialSubschema[key];
    const superschemaValue = potentialSuperschema[key];

    // 如果子模式的值是 ZodType，父模式的值可以是任意 ZodType 或 ZodDeepRaw
    // 因为我们只检查形状，不检查具体类型
    if (subschemaValue && typeof subschemaValue === "object" && !(subschemaValue instanceof z.ZodType)) {
      // 如果子模式的值是嵌套对象，递归检查
      if (superschemaValue && typeof superschemaValue === "object" && !(superschemaValue instanceof z.ZodType)) {
        if (!isSubschemaOf(subschemaValue as ZodDeepRaw, superschemaValue as ZodDeepRaw)) {
          return false;
        }
      } else {
        // 父模式的值不是嵌套对象，但子模式是，则不匹配
        return false;
      }
    }
    // 如果子模式的值是 ZodType，我们不需要进一步检查，因为父模式的值可以是任意类型
    // 只要键存在就满足形状要求
  }

  return true;
}

// 更严格的版本：要求父模式的值也是相同的类型（ZodType 或 ZodDeepRaw）
export function isStrictSubschemaOf<T extends ZodDeepRaw>(
  potentialSubschema: T,
  potentialSuperschema: T
): boolean {
  for (const key in potentialSubschema) {
    if (!(key in potentialSuperschema)) {
      return false;
    }

    const subschemaValue = potentialSubschema[key];
    const superschemaValue = potentialSuperschema[key];

    const isSubschemaObject = subschemaValue && typeof subschemaValue === "object" && !(subschemaValue instanceof z.ZodType);
    const isSuperschemaObject = superschemaValue && typeof superschemaValue === "object" && !(superschemaValue instanceof z.ZodType);

    if (isSubschemaObject) {
      if (!isSuperschemaObject) {
        return false;
      }
      if (!isStrictSubschemaOf(subschemaValue as ZodDeepRaw, superschemaValue as ZodDeepRaw)) {
        return false;
      }
    } else if (isSuperschemaObject) {
      // 子模式是 ZodType 但父模式是对象，不匹配
      return false;
    }
    // 两者都是 ZodType，继续检查（不检查具体类型）
  }

  return true;
}
