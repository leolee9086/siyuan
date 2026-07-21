import { createApp } from "vue";
import MagiRoot from "./MagiRoot.vue";
import {
    bootstrapMagiSiyuan,
    resolveMagiDesktopTargetFromPathname,
} from "../utils/environment/magiEntry.environment";
import "../../assets/scss/base.scss";
import "./MagiDesktop.css";

const rootElement = document.getElementById("magi-root");

if (!rootElement) {
    throw new Error("Missing #magi-root mount node");
}

void resolveMagiDesktopTargetFromPathname(location.pathname).then((currentTarget) => {
    return bootstrapMagiSiyuan(currentTarget);
}).then(() => {
    createApp(MagiRoot).mount(rootElement);
}).catch((error) => {
    console.error("[magi-entry] bootstrap failed:", error);
    rootElement.innerHTML = "<div style=\"padding:16px;color:#ff8080;font-family:monospace\">MAGI BOOTSTRAP FAILED</div>";
});
