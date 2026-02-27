
import z from "zod";
type HasAllKeys<Source, Target> = keyof Source extends keyof Target ? true : false;

function checkKeysSubset<Source extends z.ZodRawShape, Target extends z.ZodRawShape>(
    source: Source,
    target: Target
): HasAllKeys<Source, Target> {
    const sourceKeys = Object.keys(source);
    const targetKeys = Object.keys(target);
    const allKeysPresent = sourceKeys.every(key => targetKeys.includes(key));

    return allKeysPresent as HasAllKeys<Source, Target>;
}
checkKeysSubset({path:z.string()},{test:z.object()});


function sortZodRawShapes(shapes: z.ZodRawShape[]): z.ZodRawShape[] {
    // 创建副本以避免修改原数组
    const result = [...shapes];
    
    // 使用稳定的排序算法
    result.sort((a, b) => {
        const aIsParentOfB = checkKeysSubset(a, b);
        const bIsParentOfA = checkKeysSubset(b, a);
        
        // 如果 a 是 b 的父级，a 应该在 b 前面
        if (aIsParentOfB && !bIsParentOfA) {
            return -1;
        }
        // 如果 b 是 a 的父级，b 应该在 a 前面
        if (bIsParentOfA && !aIsParentOfB) {
            return 1;
        }
        // 否则保持原顺序（稳定排序）
        return 0;
    });
    
    return result;
}

type NarrowedInferType<
  Source extends z.ZodRawShape, 
  Target extends z.ZodRawShape
> = z.infer<z.ZodObject<Source>> & z.infer<z.ZodObject<Target>>;

// 创建收窄验证器
function createNarrowedValidator<Source extends z.ZodRawShape, Target extends z.ZodRawShape>(
  source: z.ZodObject<z.ZodRawShape>,
  target: z.ZodObject<z.ZodRawShape>
) {
  return (data: unknown): NarrowedInferType<Source, Target> => {
    const sourceResult = source.safeParse(data);
    const targetResult = target.safeParse(data);
    
    if (!sourceResult.success) {
      throw new Error(`Source validation failed: ${sourceResult.error.message}`);
    }
    
    if (!targetResult.success) {
      throw new Error(`Target validation failed: ${targetResult.error.message}`);
    }
    
    // 返回交集数据（实际上就是原始数据，因为两个验证都通过了）
    return data as NarrowedInferType<Source, Target>;
  };
}

