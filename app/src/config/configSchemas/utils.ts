import { computed } from "vue";
// UIDescriptionRegistry.ts
type SchemaID = string;

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
   initData:()=>Promise<any>,
   onchange:(data:any)=>Promise<any>
}
class UIDescriptionRegistry {
    private static instance: UIDescriptionRegistry;
    private registry = new Map<SchemaID, UIDescription>();
    private formRegistry = new Map<SchemaID, UIFormDescription>();
    private idCounter = 0;

    static getInstance(): UIDescriptionRegistry {
        if (!(globalThis as any)[Symbol.for('UIDescriptionRegistry')]) {
            UIDescriptionRegistry.instance = new UIDescriptionRegistry();
            (globalThis as any)[Symbol.for('UIDescriptionRegistry')] = UIDescriptionRegistry.instance
        }
        return UIDescriptionRegistry.instance;
    }

    // 注册 UI 描述，自动生成 raw 字符串
    registerItem(uiDescription: UIDescription): SchemaID {
        const id = `ui_${Date.now()}_${this.idCounter++}`;
        this.registry.set(id, uiDescription);
        return id;
    }
    registerForm(uiDescription: UIFormDescription): SchemaID {
        const id = `form_${Date.now()}_${this.idCounter++}`;
        this.formRegistry.set(id, uiDescription);
        return id;
    }
    // 获取 UI 描述
    get(id: SchemaID): UIDescription | null {
        return this.registry.get(id) || null;
    }



    // 清空注册表
    clear(): void {
        this.registry.clear();
        this.formRegistry.clear();
        this.idCounter = 0;
    }
}
(globalThis as any)[Symbol.for('UIDescriptionRegistry')] = (globalThis as any)[Symbol.for('UIDescriptionRegistry')] || UIDescriptionRegistry.getInstance();
export const uiDescriptionRegistry = (globalThis as any)[Symbol.for('UIDescriptionRegistry')] as UIDescriptionRegistry
