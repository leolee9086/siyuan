import { MenuItem } from "./Menu.Item";
import { getSiyuanGlobalMenus } from "../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { openTransferBlockRefDialog } from "../dialog/openTransferBlockRefDialog";
//@AI
export const transferBlockRef = (id: string) => {
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "transferBlockRef",
        label: siyuanI18n.transferBlockRef,
        icon: "iconScrollHoriz",
        click: () => openTransferBlockRefDialog(id)
    }).element);
};
