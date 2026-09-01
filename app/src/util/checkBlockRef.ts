import {confirmDialog} from "../dialog/confirmDialog";
import {showMessage} from "../dialog/message";
import {waitForPendingTransactions} from "../protyle/util/transactionQueue";
import {fetchSyncPost} from "./network/fetch";

export interface IBlockRefCheckOptions {
    scope: "blocks" | "documents" | "notebook";
    ids?: string[];
    exactIDs?: string[];
    deletedIDs?: string[];
    paths?: string[];
    notebook?: string;
}

const pendingChecks = new WeakSet<IProtyle>();

export const checkBlockRef = async (options: IBlockRefCheckOptions, protyle?: IProtyle) => {
    try {
        if (protyle) {
            await waitForPendingTransactions(protyle);
        }
        const response = await fetchSyncPost("/api/block/checkBlockRef", options);
        if (response.code !== 0) {
            showMessage(response.msg || "Check block reference failed", 7000, "error");
            return;
        }
        return response.data === true;
    } catch (error) {
        console.error("Check block reference failed", error);
        showMessage(error instanceof Error ? error.message : String(error), 7000, "error");
    }
};

export const confirmBlockRef = async (options: IBlockRefCheckOptions, protyle?: IProtyle) => {
    if (protyle?.lite) {
        return true;
    }
    if (protyle && pendingChecks.has(protyle)) {
        return false;
    }
    if (protyle) {
        pendingChecks.add(protyle);
    }
    try {
        const hasRef = await checkBlockRef(options, protyle);
        if (hasRef === undefined) {
            return false;
        }
        if (!hasRef) {
            return true;
        }
        return await new Promise<boolean>((resolve) => {
            confirmDialog(window.siyuan.languages.deleteOpConfirm, window.siyuan.languages.deleteRefConfirm,
                () => resolve(true), () => resolve(false), true);
        });
    } finally {
        if (protyle) {
            pendingChecks.delete(protyle);
        }
    }
};

/**
 * Confirms a block-removal target using the active editor context. The notebook
 * field is intentionally omitted when the editor has no notebook, because an
 * explicit undefined value is not part of the API contract.
 */
export const confirmBlockRefForBlocks = async (protyle: IProtyle, ids: readonly string[],
                                                exactIDs: readonly string[] = []) => {
    const options: IBlockRefCheckOptions = {
        scope: "blocks",
        ids: [...ids],
        exactIDs: [...exactIDs],
    };
    if (protyle.notebookId) {
        options.notebook = protyle.notebookId;
    }
    return await confirmBlockRef(options, protyle);
};

export const getBlockRefWarningHTML = () => {
    return `<div class="fn__hr"></div>
<div class="ft__smaller ft__on-surface">${window.siyuan.languages.deleteRefConfirm}</div>`;
};
