import type { Ref } from "vue";
import type { PersonaDescriptionField } from "../../../data/convergence/q2d/persona-seed-convergence-q2d-llm.types";

/**
 * 描述表单组件输入属性。
 *
 * 用途：定义描述表单按钮可用性与加载态控制字段。
 * 使用场景：PersonaSeedDescriptionsForm 组件 props。
 * 关联类型：`DescriptionItem`。
 * 问题/改进：后续可扩展问卷进度文案等展示字段。
 */
export type PersonaSeedDescriptionsFormProps = {
    readonly generatingQuestionnaireToDescription: boolean;
    readonly canGenerateTrinitySuggestion: boolean;
};

/**
 * 描述表单单项视图模型。
 *
 * 用途：统一四个描述输入框的渲染数据结构。
 * 使用场景：PersonaSeedDescriptionsForm 的 `v-for` 渲染。
 * 关联类型：`PersonaDescriptionField`、`PersonaSeedDescriptionsFormProps`。
 * 问题/改进：后续可扩展字段级 loading 与帮助文案。
 */
export type DescriptionItem = {
    readonly field: PersonaDescriptionField;
    readonly label: string;
    readonly placeholder: string;
    readonly model: Ref<string>;
    readonly disabled: boolean;
};

/**
 * 描述项静态配置结构。
 *
 * 用途：定义四个描述输入框的字段、标题和占位文案模板。
 * 使用场景：描述表单上下文构建渲染项时复用。
 * 关联类型：`DescriptionItem`。
 * 问题/改进：后续可加入字段级帮助链接。
 */
export type DescriptionItemConfig = {
    readonly field: PersonaDescriptionField;
    readonly label: string;
    readonly placeholder: string;
};

/**
 * 描述字段模型引用映射。
 *
 * 用途：按字段聚合 `defineModel` 产生的四个 `Ref<string>`。
 * 使用场景：描述表单上下文计算渲染项时按字段读取模型。
 * 关联类型：`PersonaDescriptionField`。
 * 问题/改进：后续可扩展字段级校验状态引用。
 */
export type DescriptionModelRefs = Readonly<Record<PersonaDescriptionField, Ref<string>>>;
