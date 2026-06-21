export const parseRenderOption = (text: string): unknown => {
    return new Function(`"use strict";return (${text})`)();
};
