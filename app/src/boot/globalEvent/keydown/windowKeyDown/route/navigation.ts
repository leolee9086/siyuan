/**
 * 用途：声明窗口级键盘事件在导航子集中的 `facts -> command` 路由。
 * 使用范围：仅供 `windowKeyDown/route/index.ts` 汇总各子集命令时调用。
 * 解耦评估：当前文件只做导航 facts 到命令的静态切分，不在执行期二次判断，从而保持"路由导航"作为独立阶段。
 */

/**
 * 用途：引入路由 DSL `calibur`，用于声明式地构建键盘事件 facts → command 的路由链。
 * 使用范围：仅在本文件内定义 `routeNavigationWindowKeyCommand` 路由链时使用。
 * 解耦评估：`calibur` 是纯函数式路由组合库，不依赖 SiYuan 内部状态，后续如需替换路由实现只需修改本文件的路由构建调用处。
 */
import { calibur } from "./imports";
/**
 * 用途：引入导航子集相关的键盘命令常量枚举，作为路由链的最终输出值。
 * 使用范围：仅在本文件中各 `.split()` 与 `.remain()` 回调内返回对应命令常量。
 * 解耦评估：命令常量定义在 `../types` 中并通过 `imports.ts` 聚合，路由逻辑与命令值完全分离，增减命令只需在 `../types` 中调整枚举。
 */
import { NAVIGATION_WINDOW_KEY_COMMANDS } from "./imports";
/**
 * 用途：引入 ArkType `type` 构造器，用于在编译期和运行时约束路由输入状态的结构。
 * 使用范围：仅在本文件顶部定义 `navigationWindowKeyStateRouteInput` 状态输入类型时使用，不扩散至运行时逻辑。
 * 解耦评估：类型定义属于编译期产物，可通过 ArkType 的 `.infer` 提取 TypeScript 类型，即使后续切换类型方案也只需修改此处类型定义。
 */
import { type } from "./imports";

/**
 * 用途：定义导航路由的输入状态 schema。
 * 变化：从 24+ 布尔字段（`mainMenuHotkey`、`goForwardHotkey` 等）精简为辨识联合字段 `pressedNavigationHotkey`，
 * 路由链仅基于该单值做状态空间分割。委托链字段（`replaceHotkey`/`globalSearchHotkey`/`searchHotkey`/`saveHotkey`）保留在 schema 中，
 * 以确保运行时的输入校验兼容 `WindowKeyDownState.navigation` 的完整形状。
 */
const navigationWindowKeyStateRouteInput = type({
    isTabWindow: "boolean",
    navigation: {
        pressedNavigationHotkey: "string | null",
        replaceHotkey: "boolean",
        globalSearchHotkey: "boolean",
        searchHotkey: "boolean",
        saveHotkey: "boolean",
    },
});

/**
 * 用途：基于 `pressedNavigationHotkey` 辨识联合进行一次状态空间分割的单一路由器。
 * 设计意图：每个 `.split()` 直接匹配一个 `pressedNavigationHotkey` 字面值，不再使用布尔否定链。
 * 状态空间被天然分割为 |mainMenu|goForward|goBack|recentClosed|close*|goToTab*|split*|unsplit*|remain(DELEGATED_KEYDOWN)|，
 * 任何两个 split 之间无交集，构建阶段由 calibur 编译期保证无重叠。
 * 使用范围：仅供 `windowKeyDown/route/index.ts` 汇总导航命令时调用。
 */
export const routeNavigationWindowKeyCommand = calibur
    .universe(navigationWindowKeyStateRouteInput)
    // 主菜单：仅在非标签页窗口时匹配
    .split(
        type({ isTabWindow: "false", navigation: { pressedNavigationHotkey: "'mainMenu'" } }),
        () => NAVIGATION_WINDOW_KEY_COMMANDS.MAIN_MENU,
    )
    // 前进/后退/最近关闭
    .split(type({ navigation: { pressedNavigationHotkey: "'goForward'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.GO_FORWARD)
    .split(type({ navigation: { pressedNavigationHotkey: "'goBack'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.GO_BACK)
    .split(type({ navigation: { pressedNavigationHotkey: "'recentClosed'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.RECENT_CLOSED)
    // 关闭标签
    .split(type({ navigation: { pressedNavigationHotkey: "'closeTab'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.CLOSE_TAB)
    .split(type({ navigation: { pressedNavigationHotkey: "'closeOthers'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.CLOSE_OTHERS)
    .split(type({ navigation: { pressedNavigationHotkey: "'closeAll'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.CLOSE_ALL)
    .split(type({ navigation: { pressedNavigationHotkey: "'closeUnmodified'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.CLOSE_UNMODIFIED)
    .split(type({ navigation: { pressedNavigationHotkey: "'closeLeft'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.CLOSE_LEFT)
    .split(type({ navigation: { pressedNavigationHotkey: "'closeRight'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.CLOSE_RIGHT)
    // 切换标签
    .split(type({ navigation: { pressedNavigationHotkey: "'goToTab1'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_1)
    .split(type({ navigation: { pressedNavigationHotkey: "'goToTab2'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_2)
    .split(type({ navigation: { pressedNavigationHotkey: "'goToTab3'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_3)
    .split(type({ navigation: { pressedNavigationHotkey: "'goToTab4'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_4)
    .split(type({ navigation: { pressedNavigationHotkey: "'goToTab5'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_5)
    .split(type({ navigation: { pressedNavigationHotkey: "'goToTab6'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_6)
    .split(type({ navigation: { pressedNavigationHotkey: "'goToTab7'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_7)
    .split(type({ navigation: { pressedNavigationHotkey: "'goToTab8'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_8)
    .split(type({ navigation: { pressedNavigationHotkey: "'goToTab9'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_9)
    .split(type({ navigation: { pressedNavigationHotkey: "'goToTabNext'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_NEXT)
    .split(type({ navigation: { pressedNavigationHotkey: "'goToTabPrev'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_PREV)
    // 布局操作
    .split(type({ navigation: { pressedNavigationHotkey: "'splitLR'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.SPLIT_LR)
    .split(type({ navigation: { pressedNavigationHotkey: "'splitMoveR'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.SPLIT_MOVE_R)
    .split(type({ navigation: { pressedNavigationHotkey: "'splitTB'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.SPLIT_TB)
    .split(type({ navigation: { pressedNavigationHotkey: "'tabToWindow'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.TAB_TO_WINDOW)
    .split(type({ navigation: { pressedNavigationHotkey: "'splitMoveB'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.SPLIT_MOVE_B)
    .split(type({ navigation: { pressedNavigationHotkey: "'stickSearch'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.STICK_SEARCH)
    .split(type({ navigation: { pressedNavigationHotkey: "'unsplit'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.UNSPLIT)
    .split(type({ navigation: { pressedNavigationHotkey: "'unsplitAll'" } }), () => NAVIGATION_WINDOW_KEY_COMMANDS.UNSPLIT_ALL)
    // 没有命中任何导航热键 → 落入委托链（replace/globalSearch/search/save）
    .remain(() => NAVIGATION_WINDOW_KEY_COMMANDS.DELEGATED_KEYDOWN)
    .build();
