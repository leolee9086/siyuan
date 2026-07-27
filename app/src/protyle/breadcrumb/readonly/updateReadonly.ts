/** 用途：只读属性协议常量；使用范围：块属性写入；解耦评估：经专属网关暴露稳定协议值。 */
import {Constants} from "./imports";
/** 用途：禁用编辑器；使用范围：全局只读分支；解耦评估：经专属网关直达唯一行为。 */
import {disabledProtyle} from "./imports";
/** 用途：启用编辑器；使用范围：全局只读分支；解耦评估：经专属网关直达唯一行为。 */
import {enableProtyle} from "./imports";
/** 用途：写入文档只读属性；使用范围：非全局只读分支；解耦评估：经专属网关直达网络实现。 */
import {fetchPost} from "./imports";
/** 用途：读取全局只读配置；使用范围：确定本地启停或属性写入；解耦评估：经专属网关直达环境访问器。 */
import {getSiyuanConfig} from "./imports";

/** 切换当前文档只读状态并同步编辑器。 @同步豁免: UI构建 */
export const updateReadonly = (target: Element, protyle: IProtyle) => {
    if (getSiyuanConfig()?.readonly) {
        return;
    }
    const useElement = target.querySelector("use");
    const isReadonly = useElement?.getAttribute("xlink:href") !== "#iconUnlock";
    // 全局只读模式下点击当前锁定入口只临时恢复本编辑器，不写块属性。
    if (getSiyuanConfig()?.editor.readOnly && isReadonly) {
        enableProtyle(protyle);
        return;
    }
    // 全局只读模式下其余状态统一禁用本编辑器，同样不写块属性。
    if (getSiyuanConfig()?.editor.readOnly) {
        disabledProtyle(protyle);
        return;
    }
    fetchPost("/api/attr/setBlockAttrs", {
        id: protyle.block.rootID,
        attrs: {
            [Constants.CUSTOM_SY_READONLY]: isReadonly ? "false" : "true",
        },
    });
};
