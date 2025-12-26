export const openDock = (type: string) => {
    const toolbarFile = document.getElementById("toolbarFile");
    if (toolbarFile) {
        toolbarFile.dispatchEvent(new CustomEvent("click"));
    }
    const sidebarToolbar = document.querySelector("#sidebar .toolbar--border");
    if (sidebarToolbar) {
        sidebarToolbar.dispatchEvent(new CustomEvent("click", {detail:type}));
    }
};
