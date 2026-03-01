/**
 * Trinity 问卷 - 基础信息与整合特征
 *
 * TRINITY-00 基础信息采集 + 整合特征倾向量表 + 标识信息 + 角色定位
 */
import type { QuestionnaireSection, QuestionnaireQuestion } from "../../questionnaire.types";
import { isTextQuestionWithPath } from "../questionnaire.guard";

/** 性别→姓名默认值映射 */
const genderNameMap: Record<string, { value: string; placeholder: string }> = {
    "女": { value: "REI", placeholder: "REI" },
    "男": { value: "KAWORU", placeholder: "KAWORU" },
};

const genderNameDefault = { value: "", placeholder: "请输入姓名" };

/** 性别变更时联动姓名字段的回调 */
const onGenderChange = (value: string, questions: QuestionnaireQuestion[]): void => {
    const nameQuestion = questions.find((q) =>
        isTextQuestionWithPath(q, "TRINITY.基础信息.姓名")
    );
    if (!nameQuestion) {
        return;
    }
    const mapping = genderNameMap[value] ?? genderNameDefault;
    nameQuestion.value = mapping.value;
    nameQuestion.placeholder = mapping.placeholder;
};

/** 基础信息章节 */
const basicInfoSection: QuestionnaireSection = {
    title: "基础信息",
    systemTitle: `Marduk-${Date.now()}`,
    description: "构建个体基础档案信息，包括身份标识与基础经历。",
    questions: [
        {
            text: "性别",
            type: "single",
            options: ["女", "男", "其他"],
            selectedOption: "女",
            path: "TRINITY.基础信息.性别",
            onChange: onGenderChange,
            hint: "请选择适格者的生理性别，这将影响后续的个性化评估",
        },
        {
            text: "姓名",
            type: "text",
            value: "REI",
            placeholder: "请输入姓名",
            path: "TRINITY.基础信息.姓名",
            hint: "输入适格者的标识名称，可以是代号或真实姓名",
        },
        {
            text: "年龄",
            type: "text",
            value: "14",
            placeholder: "14",
            path: "TRINITY.基础信息.年龄",
            hint: "请输入实际年龄，这将用于年龄相关的评估校准",
        },
        {
            text: "所属组织",
            type: "text",
            value: "NERV",
            path: "TRINITY.基础信息.所属组织",
            hint: "填写适格者当前隶属的主要组织机构名称",
        },
        {
            text: "职责定位",
            type: "text",
            value: "驾驶员",
            path: "TRINITY.基础信息.职责",
            hint: "描述适格者在组织中的主要职责与角色定位",
        },
        {
            text: "关键经历",
            type: "multiple_text",
            values: [],
            path: "TRINITY.基础信息.关键经历",
            hint: "列举对适格者个性形成有重要影响的关键事件或经历",
        },
    ],
};

export { basicInfoSection };
