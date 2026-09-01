import type { AppFacade } from "../../../../app/AppFacade.types";
import { openExportPreviewTab } from "../../../../export-preview/open";
import {fetchPost} from "../../../../util/network/fetch";
import { quickMakeCard } from "../../../../card/makeCard";
import { openCardByData } from "../../../../card/openCard";
import { Editor } from "../../../../editor";
import {Custom} from "../../../../layout/dock/custom/Custom";
import { openBacklink, openGraph, openOutline } from "../../../../layout/dock/util";
import { getAllModels } from "../../../../layout/getAll";
import { getActiveTab } from "../../../../layout/tabUtil";
import {saveLayout} from "../../../../layout/persistence/saveLayout";
import { zoomOut } from "../../../../menus/protyleMenus/editorMenu/protyle.zoomOut";
import {copyPNGByLink} from "../../../../asset/actions";
import { duplicateCompletely } from "../../../../protyle/render/av/action/duplicate";
import { copyTextByType } from "../../../../protyle/toolbar/util";
import { hideElements } from "../../../../protyle/ui/hideElements";
import { copyPlainText, isOnlyMeta, writeText } from "../../../../protyle/util/compatibility";
import { hasClosestBlock, hasClosestByAttribute, hasClosestByClassName } from "../../../../protyle/util/hasClosest";
import { matchHotKey } from "../../../../protyle/util/hotKey";
import { getPlainText } from "../../../../protyle/util/paste";
import { reloadProtyle } from "../../../../protyle/util/reload";
import { resize } from "../../../../protyle/util/resize";
import { focusByOffset, getSelectionOffset } from "../../../../protyle/util/selection";
import { setEditMode } from "../../../../protyle/util/setEditMode";
import { duplicateBlock, goHome } from "../../../../protyle/wysiwyg/commonHotkey/commonHotkey";
import {goEnd} from "../../../../protyle/wysiwyg/commonHotkey/goEnd/goEnd";
import {getContentByInlineHTML} from "../../../../protyle/wysiwyg/keydown/content/getContentByInlineHTML";
import { Search } from "../../../../search";
import { siyuanI18n } from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanBlockPanels, getSiyuanConfig } from "../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanDialogs } from "../../../../util/siyuanEnvironments/siyuanDialogs.environment";
import { getWindowSelection } from "../../../../util/siyuanEnvironments/windowStandard.environment";
import { execByCommand } from "../../command/panel";
import { onlyProtyleCommand } from "../../command/protyle";

export type { AppFacade };
export {
    copyPlainText,
    copyPNGByLink,
    copyTextByType,
    Custom,
    duplicateBlock,
    duplicateCompletely,
    execByCommand,
    Editor,
    fetchPost,
    focusByOffset,
    getActiveTab,
    getAllModels,
    getContentByInlineHTML,
    getPlainText,
    getSelectionOffset,
    getSiyuanBlockPanels,
    getSiyuanConfig,
    getSiyuanDialogs,
    getWindowSelection,
    goEnd,
    goHome,
    hasClosestBlock,
    hasClosestByAttribute,
    hasClosestByClassName,
    hideElements,
    isOnlyMeta,
    matchHotKey,
    onlyProtyleCommand,
    openBacklink,
    openCardByData,
    openExportPreviewTab,
    openGraph,
    openOutline,
    quickMakeCard,
    reloadProtyle,
    resize,
    saveLayout,
    Search,
    setEditMode,
    siyuanI18n,
    writeText,
    zoomOut,
};
