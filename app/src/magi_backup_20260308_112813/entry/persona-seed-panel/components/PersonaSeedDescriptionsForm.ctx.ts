import { computed, type Ref } from "vue";
import type {
    DescriptionItem,
    DescriptionItemConfig,
    DescriptionModelRefs,
    PersonaSeedDescriptionsFormProps,
} from "./PersonaSeedDescriptionsForm.types";

const DESCRIPTION_ITEM_CONFIGS: readonly DescriptionItemConfig[] = [
    {
        field: "professionalDescription",
        label: "Professional Description (Melchior)",
        placeholder: "职业场景中的能力定位、判断标准、长期职业发展方向。",
    },
    {
        field: "lifeDescription",
        label: "Life Description (Balthazar)",
        placeholder: "日常生活中的关系偏好、情绪模式、价值取舍。",
    },
    {
        field: "instinctNeedsDescription",
        label: "Instinct Needs Description (Casper)",
        placeholder: "自身核心需求、边界底线、即时驱动。",
    },
    {
        field: "integratedDescription",
        label: "Integrated Self Description (Trinity)",
        placeholder: "统一自我叙述，聚焦'我是谁、我想成为什么样的人'。",
    },
];

/**
 * 作用：构建描述表单渲染项集合。
 * 意图：把四轨文本框和按钮可用性统一映射为模板数据。
 * 调用时机：描述表单 computed 求值时调用。
 * 问题/改进：后续可按字段注入差异数量等元信息。
 */
function buildDescriptionItems(
    props: PersonaSeedDescriptionsFormProps,
    models: DescriptionModelRefs,
): readonly DescriptionItem[] {
    const items: DescriptionItem[] = [];
    for (const config of DESCRIPTION_ITEM_CONFIGS) {
        const isIntegrated = config.field === "integratedDescription";
        items.push({
            field: config.field,
            label: config.label,
            placeholder: config.placeholder,
            model: models[config.field],
            disabled: isIntegrated && !props.canGenerateTrinitySuggestion,
        });
    }
    return items;
}

/** @同步豁免: UI构建 — 组件上下文为同步计算与引用绑定。 */
/**
 * 作用：构建描述表单组件上下文。
 * 意图：将 script 逻辑抽离出 .vue，满足组件轻脚本约束。
 * 调用时机：PersonaSeedDescriptionsForm setup 阶段调用一次。
 * 问题/改进：后续可加入字段级状态派生。
 */
export function usePersonaSeedDescriptionsFormContext(
    props: PersonaSeedDescriptionsFormProps,
    models: DescriptionModelRefs,
): { readonly descriptionItems: Readonly<Ref<readonly DescriptionItem[]>> } {
    const descriptionItems = computed(() => buildDescriptionItems(props, models));
    return { descriptionItems };
}
