import { ProfileManager } from "./profileManager";

export const getSForgeConfigs = () => {
    return {
        ai: {
            modelScope: {
                auth: ProfileManager.getInstance("ai_modelscope_auth"),
                text2image: ProfileManager.getInstance("ai_modelscope_text2image")
            }
        }
    };
};
