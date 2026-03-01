/**
 * Trinity 问卷 - 角色定位评估章节
 *
 * TRINITY-01 角色定位描述量表：评估个体在不同场景中的角色定位与功能特征。
 */
import type { QuestionnaireSection } from "../../questionnaire.types";

/** 角色定位评估章节 */
export const rolePositionSection: QuestionnaireSection = {
    title: "角色定位评估",
    systemTitle: "TRINITY-01 角色定位描述量表",
    description: "评估个体在不同场景中的角色定位与功能特征。",
    questions: [
        {
            text: "职业角色描述",
            type: "multiple_text",
            values: [],
            path: "角色定位.职业角色",
            hint: "请描述候选者在职业场景中的主要角色定位，格式：角色名称: 简要职责描述。例如：数据分析师: 负责分析自然环境数据",
            placeholder: "请输入职业角色描述",
            validation: {
                pattern: /^[^:]+:.+$/,
                message: "请输入正确的格式：角色名称: 简要职责描述",
            },
        },
        {
            text: "社交角色描述",
            type: "multiple_text",
            values: [],
            path: "角色定位.社交角色",
            hint: "请描述候选者在社交场景中的主要角色定位，格式：角色名称: 简要特征描述。例如：团队协调者: 负责协调团队成员关系",
            placeholder: "请输入社交角色描述",
            validation: {
                pattern: /^[^:]+:.+$/,
                message: "请输入正确的格式：角色名称: 简要特征描述",
            },
        },
        {
            text: "自我认知角色描述",
            type: "multiple_text",
            values: [],
            path: "角色定位.自我认知",
            hint: "请描述候选者的自我认知角色定位，格式：角色名称: 简要自我描述。例如：探索者: 对未知领域充满好奇心",
            placeholder: "请输入自我认知角色描述",
            validation: {
                pattern: /^[^:]+:.+$/,
                message: "请输入正确的格式：角色名称: 简要自我描述",
            },
        },
    ],
};
