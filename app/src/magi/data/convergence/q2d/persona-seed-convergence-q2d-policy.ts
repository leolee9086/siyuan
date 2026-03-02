import type {
    PersonaDescriptionField,
    PersonaSideDescriptionField,
} from "./persona-seed-convergence-q2d-llm.types";

const SIDE_FIELDS: readonly PersonaSideDescriptionField[] = [
    "professionalDescription",
    "lifeDescription",
    "instinctNeedsDescription",
];

/**
 * 作用：统计描述文本有效长度（去除首尾空白）。
 * 意图：用于比较三侧描述完整度，决定优先补充侧面。
 * 调用时机：计算最短侧字段时调用。
 * 问题/改进：当前按字符长度，后续可按句子信息密度优化。
 */
function countDescriptionLength(text: string): number {
    return text.trim().length;
}

/**
 * 作用：从四轨描述中提取三侧描述快照。
 * 意图：复用最短侧策略输入，避免重复字段选择代码。
 * 调用时机：问卷->描述建议生成前调用。
 * 问题/改进：后续可合并为统一描述视图模型。
 */
/** @同步豁免: UI构建 — 纯字段映射属于同步内存计算。 */
export function toSideDescriptionSnapshot(descriptions: Readonly<Record<PersonaDescriptionField, string>>): Readonly<Record<PersonaSideDescriptionField, string>> {
    return {
        professionalDescription: descriptions.professionalDescription,
        lifeDescription: descriptions.lifeDescription,
        instinctNeedsDescription: descriptions.instinctNeedsDescription,
    };
}

/** @同步豁免: UI构建 — 纯文本长度比较用于提示词参数计算，无异步必要。 */
/**
 * 作用：计算当前应优先更新的最短侧字段。
 * 意图：落实“描述建议优先更新当前最短侧”规则。
 * 调用时机：每次发起问卷->描述建议生成前调用。
 * 问题/改进：并列时按字段顺序稳定选择，后续可加入用户手动偏好。
 */
export function resolveShortestSideDescriptionField(
    sideDescriptions: Readonly<Record<PersonaSideDescriptionField, string>>,
): PersonaSideDescriptionField {
    let shortestField = SIDE_FIELDS[0];
    let shortestLength = Number.POSITIVE_INFINITY;
    for (const field of SIDE_FIELDS) {
        const length = countDescriptionLength(sideDescriptions[field]);
        // 更短时更新优先字段，并列保持先出现字段稳定性。
        if (length < shortestLength) {
            shortestLength = length;
            shortestField = field;
        }
    }
    return shortestField;
}
