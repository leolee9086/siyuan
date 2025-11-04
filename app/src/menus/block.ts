import { MenuItem } from "./Menu.Item";
import { getGlobalMenus } from "../util/siyuanEnvironments/getMenu";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n";
import { openTransferBlockRefDialog } from "../dialog/openTransferBlockRefDialog";

export const transferBlockRef = (id: string) => {
    getGlobalMenus().menu.append(new MenuItem({
        id: "transferBlockRef",
        label: siyuanI18n.transferBlockRef,
        icon: "iconScrollHoriz",
        click: () => openTransferBlockRefDialog(id)
    }).element);
};
