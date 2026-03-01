/**
 * Trinity 问卷 - 标识信息与角色定位章节
 *
 * 用于构建个体基础特征档案和角色定位评估。
 */
import type { QuestionnaireSection } from "../../questionnaire.types";

/** 标识信息章节 */
export const identitySection: QuestionnaireSection = {
    title: "标识信息",
    systemTitle: "TRINITY-00 基础信息采集",
    description: "用于构建个体基础特征档案，包括外显特征与识别标记。",
    questions: [
        {
            text: "体态特征",
            type: "text",
            value: "",
            placeholder: "请输入体态特征描述",
            path: "标识信息.外显特征.体态",
            hint: "描述适格者当前体态特征，如：纤细、标准、强壮等",
        },
        {
            text: "显著标记",
            type: "text",
            value: "",
            placeholder: "请输入显著标记描述",
            path: "标识信息.外显特征.显著标记",
            hint: "描述适格者具有的明显外观特征，如：蓝发、红瞳等",
        },
        {
            text: "识别特征",
            type: "text",
            value: "",
            placeholder: "请输入识别特征描述",
            path: "标识信息.外显特征.识别特征",
            hint: "描述可用于识别的特殊标记或行为特征，如：左臂绷带、轻微体颤等",
        },
        {
            text: "性格特征 - 内向程度",
            type: "text",
            value: "",
            placeholder: "请输入性格内向程度描述",
            path: "完整人格.基础信息.性格特征.内向程度",
            hint: "描述适格者在社交场合的倾向性，如：极度内向、偏外向等",
        },
        {
            text: "表达方式",
            type: "text",
            value: "",
            placeholder: "请输入表达方式描述",
            path: "完整人格.基础信息.性格特征.表达方式",
            hint: "描述适格者惯用的沟通表达方式，如：简洁含蓄、热情开放等",
        },
        {
            text: "生活环境",
            type: "text",
            value: "",
            placeholder: "请输入生活环境描述",
            path: "标识信息.周边特征.生活环境",
            hint: "描述适格者的主要生活环境特征，包括居住类型、社区特征、环境安全等级等",
        },
        {
            text: "活动模式",
            type: "text",
            value: "",
            placeholder: "请输入活动模式描述",
            path: "标识信息.周边特征.活动模式",
            hint: "描述适格者的日常活动规律，包括通勤方式、主要活动区域、活动半径等",
        },
        {
            text: "社交网络",
            type: "text",
            value: "",
            placeholder: "请输入社交网络描述",
            path: "标识信息.周边特征.社交网络",
            hint: "描述适格者的社交关系特征，包括主要社交对象、互动频率、社交圈层等",
        },
        {
            text: "作息规律",
            type: "text",
            value: "",
            placeholder: "请输入作息规律描述",
            path: "标识信息.周边特征.作息规律",
            hint: "描述适格者的作息特征，包括睡眠时间、工作时段、休息规律等",
        },
    ],
};
