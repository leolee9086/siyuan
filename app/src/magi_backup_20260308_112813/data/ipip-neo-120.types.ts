/**
 * IPIP-NEO-120 的主维度枚举类型。
 *
 * 用途：限定题目所属的 Domain 只能是 N/E/O/A/C。
 * 使用场景：`IpipNeo120Item.domain` 字段、分布校验统计。
 * 关联类型：与 `IpipNeo120Item`、`IpipNeo120DistributionReport` 配合使用。
 * 问题/改进：当前使用字符串字面量联合，后续如需国际化展示可额外引入映射表。
 */
export type IpipNeo120Domain = "N" | "E" | "O" | "A" | "C";

/**
 * IPIP-NEO-120 的子维度编号类型。
 *
 * 用途：限定 Facet 取值范围为 1~6。
 * 使用场景：`IpipNeo120Item.facet` 字段、分布校验。
 * 关联类型：与 `IpipNeo120Domain` 共同确定一个题目的维度定位。
 * 问题/改进：目前为固定数字联合；若未来扩展量表版本，可改为版本化泛型。
 */
export type IpipNeo120Facet = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * IPIP-NEO-120 的题目计分方向类型。
 *
 * 用途：标记题目是正向计分（plus）还是反向计分（minus）。
 * 使用场景：前端展示与后端计分转换。
 * 关联类型：`IpipNeo120Item`。
 * 问题/改进：当前仅保存符号，后续可增加中文标签映射提升可读性。
 */
export type IpipNeo120Keyed = "plus" | "minus";

/**
 * 单条 IPIP-NEO-120 题目元数据。
 *
 * 用途：承载题号、文本、domain、facet、keyed 五元信息。
 * 使用场景：题库渲染、答案采集、分布校验。
 * 关联类型：`IpipNeo120Domain`、`IpipNeo120Facet`、`IpipNeo120Keyed`。
 * 问题/改进：text 目前直接存储展示文案，后续可拆分为 key + i18n 字典。
 */
export interface IpipNeo120Item {
    readonly q: number;
    readonly text: string;
    readonly domain: IpipNeo120Domain;
    readonly facet: IpipNeo120Facet;
    readonly keyed: IpipNeo120Keyed;
}

/**
 * 题库分布校验报告。
 *
 * 用途：输出校验后得到的汇总统计和错误信息。
 * 使用场景：模块初始化自检、迁移验收日志。
 * 关联类型：由 `validateIpipNeo120Distribution` 产生。
 * 问题/改进：当前 facetCounts 使用字符串键，后续可引入更强约束的键类型工具。
 */
export interface IpipNeo120DistributionReport {
    readonly total: number;
    readonly domainCounts: Readonly<Record<IpipNeo120Domain, number>>;
    readonly facetCounts: Readonly<Record<string, number>>;
    readonly isValid: boolean;
    readonly errors: readonly string[];
}

const DOMAIN_KEYS: readonly IpipNeo120Domain[] = ["N", "E", "O", "A", "C"];
const FACET_KEYS: readonly IpipNeo120Facet[] = [1, 2, 3, 4, 5, 6];

/**
 * 创建 Domain 计数容器。
 *
 * 作用：初始化 N/E/O/A/C 五个 Domain 的计数为 0。
 * 意图：避免重复手写初始化对象，保持统计结构统一。
 * 调用时机：仅在分布校验函数启动时调用一次。
 * 问题/改进：若后续支持多量表，可抽象为通用维度计数工厂。
 */
const createDomainCounts = (): Record<IpipNeo120Domain, number> => ({
    N: 0,
    E: 0,
    O: 0,
    A: 0,
    C: 0,
});

/**
 * 创建 Facet 计数容器。
 *
 * 作用：初始化 5×6 共 30 个 domain+facet 键的计数为 0。
 * 意图：保证统计阶段可直接自增，避免 undefined 分支。
 * 调用时机：仅在分布校验函数启动时调用一次。
 * 问题/改进：当前键名格式为 `${domain}${facet}`，后续可增加常量枚举以便复用。
 */
const createFacetCounts = (): Record<string, number> => {
    const facetCounts: Record<string, number> = {};

    for (const domain of DOMAIN_KEYS) {
        for (const facet of FACET_KEYS) {
            facetCounts[`${domain}${facet}`] = 0;
        }
    }

    return facetCounts;
};

/** @同步豁免: 生命周期 */
/**
 * 校验 IPIP-NEO-120 题库分布是否满足标准结构。
 *
 * 作用：统计总题数、Domain 分布、Facet 分布并输出错误清单。
 * 意图：确保题库始终满足“120 题、每 Domain 24、每 Facet 4”的硬约束。
 * 调用时机：题库模块构建完成后立即调用（迁移阶段的自动自检）。
 * 问题/改进：当前仅校验数量，不校验题号连续性与重复文本，可在后续增强。
 */
export const validateIpipNeo120Distribution = (
    items: readonly IpipNeo120Item[],
): IpipNeo120DistributionReport => {
    const domainCounts = createDomainCounts();
    const facetCounts = createFacetCounts();

    for (const item of items) {
        domainCounts[item.domain] += 1;

        const facetKey = `${item.domain}${item.facet}`;
        const currentFacetCount = facetCounts[facetKey];
        if (currentFacetCount === undefined) {
            throw new Error(`Facet 统计键不存在: ${facetKey}`);
        }

        facetCounts[facetKey] = currentFacetCount + 1;
    }

    const errors: string[] = [];

    // 迁移验收的第一道硬约束：题库必须恰好 120 条。
    if (items.length !== 120) {
        errors.push(`总题数应为 120，实际为 ${items.length}`);
    }

    // 第二道硬约束：每个 Domain 必须固定 24 题。
    for (const domain of DOMAIN_KEYS) {
        // 校验 domain 计数，确保 domain 维度均匀覆盖。
        if (domainCounts[domain] !== 24) {
            errors.push(`Domain ${domain} 题数应为 24，实际为 ${domainCounts[domain]}`);
        }
    }

    // 第三道硬约束：每个 Domain 下每个 Facet 必须固定 4 题。
    for (const domain of DOMAIN_KEYS) {
        for (const facet of FACET_KEYS) {
            const facetKey = `${domain}${facet}`;
            const facetCount = facetCounts[facetKey];
            if (facetCount === undefined) {
                errors.push(`Facet ${facetKey} 统计缺失`);
                continue;
            }

            // 校验 facet 计数，确保 5×6 结构中的每个子维度都有且仅有 4 题。
            if (facetCount !== 4) {
                errors.push(`Facet ${facetKey} 题数应为 4，实际为 ${facetCount}`);
            }
        }
    }

    return {
        total: items.length,
        domainCounts,
        facetCounts,
        isValid: errors.length === 0,
        errors,
    };
};

/** 计分累加中间结果（供 ipip-neo-120-scoring 内部使用） */
export type ScoringAccumulation = {
    readonly domainSum: Record<IpipNeo120Domain, number>;
    readonly domainCount: Record<IpipNeo120Domain, number>;
    readonly facetSum: Record<string, number>;
    readonly facetCount: Record<string, number>;
};
