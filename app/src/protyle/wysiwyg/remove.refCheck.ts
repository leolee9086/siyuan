import {showMessage} from "../../dialog/message";
import {confirmBlockRefForBlocks} from "../../util/checkBlockRef";

type BlockID = string | null | undefined;

/**
 * Confirms a deletion that can remove a block definition, then verifies that
 * the DOM targets still exist after the asynchronous interaction.
 */
export const confirmRefRemoval = async (protyle: IProtyle, ids: BlockID[], elements: Element[],
                                        exactIDs: BlockID[] = []) => {
    const blockIDs = ids.filter((id): id is string => Boolean(id));
    if (blockIDs.length === 0) {
        console.error("Referenced block removal target has no block ID", {ids, elements});
        showMessage("Check block reference failed", 7000, "error");
        return false;
    }
    const confirmed = await confirmBlockRefForBlocks(
        protyle,
        Array.from(new Set(blockIDs)),
        Array.from(new Set(exactIDs.filter((id): id is string => Boolean(id)))),
    );
    if (confirmed && elements.every(item => item.isConnected)) {
        return true;
    }
    protyle.observerLoad?.observe(protyle.wysiwyg.element);
    return false;
};
