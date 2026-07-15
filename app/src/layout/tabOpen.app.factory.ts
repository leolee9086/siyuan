/** 完整 App 的普通 Tab 能力适配器；核心菜单只依赖 tabOpen.port。 */
import {getInstanceById, getWndByLayout} from "./util";
import {getCenterLayout} from "./util.environment";
import {Wnd} from "./Wnd";
import {Tab} from "./Tab";
import {getTabFloatFactory} from "./tabFloat.registry";
import {setLayoutTabOpenPort} from "./tabOpen.port";
import type {ILayoutTabOpenRequest} from "./tabOpen.types";

// 静态加载内建模型副本工厂，避免动态 import 造成初始化和构建时序不稳定。
import "./dock/agent/tabFloat.factory";

const findCenterWnd = (): Wnd | undefined => {
    const centerLayout = getCenterLayout();
    if (!centerLayout) {
        return undefined;
    }
    const activeElement = document.querySelector(".layout__center .layout__wnd--active");
    if (activeElement) {
        const activeId = activeElement.getAttribute("data-id");
        const activeWnd = activeId ? getInstanceById(activeId, centerLayout) : undefined;
        if (activeWnd instanceof Wnd) {
            return activeWnd;
        }
    }
    return getWndByLayout(centerLayout);
};

const createAppTabOpenPort = () => ({
    async open(source: Tab, _requestSource: ILayoutTabOpenRequest["source"] = "agent-dock") {
        const factory = getTabFloatFactory(source);
        const wnd = findCenterWnd();
        if (!factory || !wnd) {
            return false;
        }

        let target: Tab;
        try {
            target = factory.createTab(source);
        } catch (error) {
            console.error(`[layout-tab-open] failed to prepare ${factory.id} copy`, error);
            return true;
        }

        let copy: Awaited<ReturnType<typeof factory.create>> | undefined;
        try {
            // 先完成模型初始化，再把 Tab 放入布局，避免异步窗口在初始化期间被激活而访问空 model。
            copy = await factory.create(source, target);
            if (!copy) {
                return true;
            }
            if (!target.model) {
                copy.dispose();
                return true;
            }
            wnd.addTab(target, false, true);
            copy.setCloseHandler?.(() => {
                if (wnd.children.some((item) => item.id === target.id)) {
                    wnd.removeTab(target.id);
                }
            });
            return true;
        } catch (error) {
            copy?.dispose();
            console.error(`[layout-tab-open] failed to create ${factory.id} copy`, error);
            return true;
        }
    },
});

setLayoutTabOpenPort(createAppTabOpenPort());
