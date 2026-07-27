// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

/** 用途：完整动作注册项与状态；使用范围：动作注册表和插件 API；解耦评估：纯领域类型不加载具体 App 或动作实现。 */
import type {FrontendAction} from "./types";
/** 用途：创建无状态内建动作定义；使用范围：注册表首次初始化；解耦评估：动作仅通过完整 AppFacade 执行宿主行为。 */
import {createBuiltInActions} from "./builtIns";
/** 用途：读取和登记统一动作状态；使用范围：注册、查询和卸载；解耦评估：直达 SForge 状态唯一实现。 */
import {getSForgeState} from "./imports";
/** 用途：登记统一动作状态；使用范围：注册表首次初始化；解耦评估：本地网关直达 SForge 状态唯一实现。 */
import {setSForgeState} from "./imports";
/** 用途：定位前端动作注册表；使用范围：统一状态读写；解耦评估：模块级 Symbol 只提供不可变身份。 */
import {FRONTEND_ACTION_REGISTRY} from "./imports";

/** 兼容既有插件动作注册调用方的前端动作类型出口。 */
export type {IAction} from "./types";

// Centralized action registry. Data structure is a registry so that plugins can register their
// own frontend actions in a future version (via Plugin.addAction() -> registerAction). The first
// version only loads built-in actions, but the lookup layer is already registry-shaped, so adding
// plugin support later requires zero changes to the dispatch path.
//
/** 读取或初始化唯一前端动作注册状态。 */
function getFrontendActionRegistry() {
    let state = getSForgeState(FRONTEND_ACTION_REGISTRY);
    if (!state) {
        state = {actions: new Map(), builtInsInitialized: false};
        setSForgeState(FRONTEND_ACTION_REGISTRY, state);
    }
    return state;
}

/** 在第一次注册或查询前登记内建动作，确保插件后注册时仍可覆盖同名动作。 */
function ensureBuiltInActions() {
    const state = getFrontendActionRegistry();
    if (state.builtInsInitialized) {
        return state;
    }
    state.builtInsInitialized = true;
    if (document.getElementById("sidebar")) {
        return state;
    }
    for (const action of createBuiltInActions()) {
        state.actions.set(action.name, action);
    }
    return state;
}

/** 登记一个动作；内建动作先初始化，随后允许插件覆盖同名动作。
 * @同步豁免: 生命周期 - 插件注册返回时动作必须已可查询，异步化会改变既有插件 API 时序。
 */
export const registerAction = (action: FrontendAction) => {
    ensureBuiltInActions().actions.set(action.name, action);
};

/** 按名称查询当前注册表中的动作，未登记时返回 undefined。
 * @同步豁免: 性能考虑 - 消息分派热路径需要同步常数时间查询，且不包含 I/O。
 */
export const lookupAction = (name: string) => ensureBuiltInActions().actions.get(name);

/** 返回当前动作注册表快照，供宿主菜单构建使用。
 * @同步豁免: UI构建 - 菜单能力枚举必须在当前渲染调用栈内生成完整快照。
 */
export const listActions = () => {
    const state = ensureBuiltInActions();
    return Array.from(state.actions.values());
};

/** 删除指定动作；内建动作也遵循注册表的显式删除语义。
 * @同步豁免: 生命周期 - 插件卸载返回时动作必须已经失效，避免卸载后的处理器继续执行。
 */
export const unregisterAction = (name: string) => {
    ensureBuiltInActions().actions.delete(name);
};
