import {wysiwygBrand} from "../../src/protyle/wysiwyg/domain/wysiwyg.types";
import type {WYSIWYGDomain} from "../../src/protyle/wysiwyg/domain/wysiwyg.types";

/** 创建供领域消费者测试使用的完整 WYSIWYG 公共表面。 */
export const createWYSIWYGDomainFixture = (element = document.createElement("div")) => ({
    [wysiwygBrand]: "WYSIWYG" as const,
    lastHTMLs: {},
    element,
    preventKeyup: false,
    renderCustom: () => undefined,
    flushPendingInput: () => undefined,
    withInputSuppressed: <T>(callback: () => T) => callback(),
} satisfies WYSIWYGDomain);
