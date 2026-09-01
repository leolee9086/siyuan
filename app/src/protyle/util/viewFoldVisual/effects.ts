/** 用途：处理异步插入标题子块的代码渲染。使用范围：视图折叠视觉刷新。解耦评估：从同域网关读取，折叠状态层不加载渲染器。 */
import {processRender} from "./imports";
/** 用途：处理异步插入标题子块的文本高亮。使用范围：视图折叠视觉刷新。解耦评估：从同域网关读取，折叠状态层不加载渲染器。 */
import {highlightRender} from "./imports";
/** 用途：处理异步插入标题子块的属性视图。使用范围：视图折叠视觉刷新。解耦评估：从同域网关读取，折叠状态层不加载 AV。 */
import {avRender} from "./imports";
/** 用途：处理异步插入标题子块的块级内容。使用范围：视图折叠视觉刷新。解耦评估：从同域网关读取，折叠状态层不加载块渲染。 */
import {blockRender} from "./imports";
/** 用途：恢复异步插入后的编辑器禁用态。使用范围：视图折叠视觉刷新。解耦评估：从同域网关读取，折叠状态层不加载 onGet。 */
import {disabledProtyle} from "./imports";
/** 用途：注册视图折叠视觉端口。使用范围：Protyle 启动阶段。解耦评估：端口定义保持无渲染依赖。 */
import {setViewFoldVisualEffects} from "./port";

/** 作用：按既有顺序处理异步插入的标题子块。意图：保留代码、高亮、AV 和块级渲染的完整视觉收尾。调用时机：标题展开请求返回后。 */
const renderHeadingChildren = (protyle: IProtyle, children: Element[]) => {
    for (const child of children) {
        processRender(child);
        highlightRender(child);
        avRender(child, protyle);
        blockRender(protyle, child);
    }
};

setViewFoldVisualEffects({
    renderHeadingChildren,
    applyDisabledState: disabledProtyle,
});
