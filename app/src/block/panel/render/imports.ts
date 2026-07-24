/** 用途：面板 DOM 祖先定位；使用范围：Panel.render 定位嵌入块；解耦评估：稳定 DOM 工具。 */
import {hasClosestByClassName} from "../../../protyle/util/hasClosest";
/** 导出面板 DOM 祖先定位。 */
export {hasClosestByClassName};
/** 用途：浮层坐标设置；使用范围：Panel.render 所有定位分支；解耦评估：稳定 DOM 算法。 */
import {setPosition} from "../../../util/DOM/positioning/setPosition";
/** 导出浮层坐标设置。 */
export {setPosition};
/** 用途：布局尺寸与动作常量；使用范围：Panel.render 高度和按钮；解耦评估：稳定常量。 */
import {Constants} from "../../../constants";
/** 导出布局尺寸与动作常量。 */
export {Constants};
/** 用途：快捷键提示格式化；使用范围：Panel.render 按钮提示；解耦评估：稳定平台实现。 */
import {updateHotkeyAfterTip} from "../../../util/platform/hotkey/format";
/** 导出快捷键提示格式化。 */
export {updateHotkeyAfterTip};
/** 用途：界面文案；使用范围：Panel.render HTML；解耦评估：只读语言环境。 */
import {siyuanI18n} from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出界面文案。 */
export {siyuanI18n};
/** 用途：读取快捷键配置；使用范围：Panel.render HTML；解耦评估：只读配置环境。 */
import {getSiyuanConfig} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出只读配置读取。 */
export {getSiyuanConfig};
/** 用途：分配浮层层级；使用范围：Panel.render 完成定位；解耦评估：稳定全局环境动作。 */
import {incrementSiyuanZIndex} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出浮层层级分配。 */
export {incrementSiyuanZIndex};
/** 用途：读取视口高度；使用范围：Panel.render 高度约束；解耦评估：标准窗口环境。 */
import {getWindowInnerHeight} from "../../../util/siyuanEnvironments/getWindowInnerHeight.environment";
/** 导出视口高度读取。 */
export {getWindowInnerHeight};
/** 用途：DOM class 判断；使用范围：Panel.render 目标分类；解耦评估：纯 DOM 工具。 */
import {checkClassListContain} from "../../../util/DOM/helpers/fnClasses";
/** 导出 DOM class 判断。 */
export {checkClassListContain};
/** 用途：桌面窗口按钮判断；使用范围：Panel.render 新窗口入口；解耦评估：稳定平台常量。 */
import {isElectron} from "../../../platform";
/** 导出桌面平台判断。 */
export {isElectron};
