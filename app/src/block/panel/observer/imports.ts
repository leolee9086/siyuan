/** 用途：观察器防抖时长；使用范围：Panel.observer；解耦评估：稳定常量。 */
import {Constants} from "../../../constants";
/** 导出观察器防抖时长。 */
export {Constants};
/** 用途：观察目标类型守卫；使用范围：Panel.observer 懒加载；解耦评估：纯 DOM 守卫。 */
import {isHTMLElement} from "../../../util/DOM/element.guard";
/** 导出观察目标类型守卫。 */
export {isHTMLElement};
/** 用途：观察器计时器；使用范围：Panel.observer 防抖；解耦评估：标准窗口环境。 */
import {setTimeout} from "../../../util/siyuanEnvironments/windowTimer.environment";
/** 导出观察器延迟动作。 */
export {setTimeout};
/** 用途：取消观察器计时器；使用范围：Panel.observer 防抖；解耦评估：标准窗口环境。 */
import {clearTimeout} from "../../../util/siyuanEnvironments/windowTimer.environment";
/** 导出取消观察器计时器。 */
export {clearTimeout};

/** 用途：创建 DOM 观察器；使用范围：Panel 尺寸同步与懒加载；解耦评估：直达共享观察器工厂唯一实现。 */
import {createIntersectionObserver, createResizeObserver} from "../../../util/DOM/observers.factory";
/** 导出尺寸观察器工厂。 */
export {createResizeObserver};
/** 导出可见性观察器工厂。 */
export {createIntersectionObserver};
