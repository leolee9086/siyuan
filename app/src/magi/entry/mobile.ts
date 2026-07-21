import { createApp } from "vue";
import MagiRoot from "./MagiRoot.vue";
import { bootstrapMagiSiyuan } from "../utils/environment/magiEntry.environment";
import "../../assets/scss/mobile.scss";
import "./MagiMobile.css";

const rootElement = document.getElementById("magi-root");

if (!rootElement) {
    throw new Error("Missing #magi-root mount node");
}

void bootstrapMagiSiyuan("magi-mobile").then(() => {
    createApp(MagiRoot).mount(rootElement);
}).catch((error) => {
    console.error("[magi-entry] bootstrap failed:", error);
    rootElement.innerHTML = "<div style=\"padding:16px;color:#ff8080;font-family:monospace\">MAGI BOOTSTRAP FAILED</div>";
});
