export const isKeymapGeneral = (keymap: Config.IKeys): keymap is Config.IKeymapGeneral => {
    return true;
};

export const isKeymapEditorSection = (keymap: Config.IKeys): keymap is Config.IKeymapEditor[keyof Config.IKeymapEditor] => {
    return true;
};

export const isHTMLElement = (target: EventTarget | null): target is HTMLElement => {
    return target instanceof HTMLElement;
};
