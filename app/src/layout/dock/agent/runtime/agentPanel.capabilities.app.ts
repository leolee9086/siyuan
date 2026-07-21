import type {App} from "../../../../index";
import type {Tab} from "../../../Tab";
import {confirmDialog} from "../../../../dialog/confirmDialog";
import {showMessage} from "../../../../dialog/message";
import {sendNotification} from "../../../../plugin/platformUtils";
import {setPanelFocus} from "../../../util";
import {getDockByType} from "../../../tabUtil";
import {requestOpenTabAsDialog} from "../../../tabFloat.port";
import {requestOpenTabAsTab} from "../../../tabOpen.port";
import {listActions, lookupAction} from "../frontendActions";
import {openIdentityAccessTab} from "../../../../magi/identity-access/adapters/open";
import {requestMagiIdentityAccess} from "../../../../magi/service/magiIdentitySession";
import {postRender} from "../AgentMessageRenderer";
import {createAppPanelMenuPort} from "./agentPanel.menu.app";
import type {AgentPanelCapabilities} from "./agentPanel.ports.types";

export const createAppAgentPanelCapabilities = (app: App, tab: Tab): AgentPanelCapabilities => ({
    settingsNavigation: {
        async openAISettings() {
            const existing = window.siyuan.dialogs.find((dialog) => dialog.element.querySelector(".config__tab-container"));
            if (!existing) {
                const {openSetting} = await import("../../../../config");
                openSetting(app, "ai");
            }
        },
    },
    identityAccess: {
        async openIdentityAccess() {
            await openIdentityAccessTab({app});
            requestMagiIdentityAccess();
        },
    },
    notification: {
        notify(notification) {
            sendNotification({...notification, timeoutType: "default"});
        },
    },
    message: {show: showMessage},
    confirm: {confirm: confirmDialog},
    menu: createAppPanelMenuPort(),
    pluginActions: {
        list: () => listActions()
            .filter((action) => action.name.startsWith("plugin__") && action.description)
            .map((action) => ({name: action.name, description: String(action.description)})),
        async execute(name, args) {
            const action = lookupAction(name);
            return action?.handler(args, app);
        },
    },
    focus: {focus: setPanelFocus},
    dockVisibility: {
        minimize() {
            getDockByType("agentChat").toggleModel("agentChat", false, true);
        },
    },
    tabOpen: {open: () => requestOpenTabAsTab(tab)},
    floatOpen: {open: () => requestOpenTabAsDialog(tab)},
    contentRender: {postRender: (container) => postRender(container, app)},
});
