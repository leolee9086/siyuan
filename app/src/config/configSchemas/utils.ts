import { computed } from "vue";
import { z } from "zod";

// 使用zod定义UIDescription的schema
const UIDescriptionSchema = z.object({
    // UI 配置
    //用于配置使用的组件
    component: z.string().optional(),
    label: z.string(),
    order: z.number().optional(),
    class: z.string().optional(),
    options: z.any().array().optional(),
    optionsRef: z.string().optional(),

    // 回调函数
    callbacks: z.object({
        onChange: z.string().optional(),
        onFocus: z.string().optional(),
        onBlur: z.string().optional(),
    }).optional(),

    model: z.any(), // computed对象
    // 动态行为
    dynamic: z.object({
        visible: z.string().optional(),
        disabled: z.string().optional(),
        options: z.string().optional(),
    }).optional(),

    // 强制 raw 字段，用于序列化
    description: z.string(),
});

// 使用zod定义UIFormDescription的schema
const UIFormDescriptionSchema = z.object({
    initData: z.function().input(z.any()).output(z.any()),
    onchange: z.function().input(z.any()).output(z.any()),
});

// 导出类型
export type UIDescription = z.infer<typeof UIDescriptionSchema>;
export type UIFormDescription = z.infer<typeof UIFormDescriptionSchema>;

// 导出schema用于运行时验证
export { UIDescriptionSchema, UIFormDescriptionSchema };
