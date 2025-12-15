/**
 * 组合约束配置
 * 
 * 将各个规则片段组合成完整的约束集合
 */

import { BASE_ARCHITECTURE_RESTRICTIONS } from './base-architecture.ts'
import { STRICT_TYPE_RESTRICTIONS } from './strict-type.ts'
import { STRICT_IMPORT_RESTRICTIONS } from './strict-import.ts'
import { STRICT_CLASS_RESTRICTIONS } from './strict-class.ts'
import { ONLY_ALLOW_TYPE_IMPORTS } from './only-type-imports.ts'
import { NO_MAGIC_STRINGS } from './no-magic-strings.ts'
import { RESTRICTION_NO_DYNAMIC_IMPORT, RESTRICTION_NO_NETWORK } from './dynamic-network.ts'
import { NO_SINGLE_CHAR_VAR_RESTRICTIONS, ID_LENGTH_RULE_CONFIG } from './no-single-char-vars.ts'

/**
 * 全局默认逻辑约束 (包含所有禁令)
 * 大多数业务文件都应该遵守这个集合
 */
export const GLOBAL_LOGIC_RESTRICTIONS = [
    ...BASE_ARCHITECTURE_RESTRICTIONS,
    RESTRICTION_NO_DYNAMIC_IMPORT, // 默认禁止 import()
    RESTRICTION_NO_NETWORK         // 默认禁止 fetch
];

// 导出所有基础约束供其他配置使用
export {
    BASE_ARCHITECTURE_RESTRICTIONS,
    STRICT_TYPE_RESTRICTIONS,
    STRICT_IMPORT_RESTRICTIONS,
    STRICT_CLASS_RESTRICTIONS,
    ONLY_ALLOW_TYPE_IMPORTS,
    NO_MAGIC_STRINGS,
    RESTRICTION_NO_DYNAMIC_IMPORT,
    RESTRICTION_NO_NETWORK,
    NO_SINGLE_CHAR_VAR_RESTRICTIONS,
    ID_LENGTH_RULE_CONFIG
};
