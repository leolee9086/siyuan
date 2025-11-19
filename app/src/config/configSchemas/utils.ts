import { computed } from "vue";
// UIDescriptionRegistry.ts

interface UIDescription {
    // UI 配置
    //用于配置使用的组件
    component?: string;
    label: string;
    order?: number;
    class?: string;
    options?: any[];
    optionsRef?: string;

    // 回调函数
    callbacks?: {
        onChange?: string;
        onFocus?: string;
        onBlur?: string;
    };
    model: ReturnType<typeof computed>,
    // 动态行为
    dynamic?: {
        visible?: string;
        disabled?: string;
        options?: string;
    };

    // 强制 raw 字段，用于序列化
    description: string;
}
interface UIFormDescription {
    initData: () => Promise<any>,
    onchange: (data: any) => Promise<any>
}
export type { UIDescription, UIFormDescription }
