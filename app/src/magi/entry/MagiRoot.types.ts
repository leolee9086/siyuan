import type { ComputedRef, InjectionKey, Ref } from "vue";
import type { WrappedSeel, UseMagiReturn } from "../composables/useMagi.types";
import type { MagiMessage } from "../utils/messageFactory.types";
import type { PersonaSeedSavedEvent } from "./persona-seed-panel/PersonaSeedPanel.types";

/**
 * MagiRoot 上下文返回值
 *
 * 用途：定义 `MagiRoot.vue` 模板所需的状态与交互方法。
 * 使用场景：`useMagiRootContext` 返回对象的类型约束。
 * 关联类型：`UseMagiReturn`、`WrappedSeel`、`MagiMessage`。
 */
export interface MagiRootContext {
    ready: Ref<boolean>;
    bootError: Ref<string | null>;
    inputValue: Ref<string>;
    showMessages: Ref<boolean>;
    showSeels: Ref<boolean>;
    showTrinity: Ref<boolean>;
    showQuestionnairePanel: Ref<boolean>;
    seels: ComputedRef<WrappedSeel[]>;
    sageSeels: ComputedRef<WrappedSeel[]>;
    trinitySeel: ComputedRef<WrappedSeel | null>;
    displayMessages: ComputedRef<MagiMessage[]>;
    isAnySeelLoading: ComputedRef<boolean>;
    onSubmitInput: (value: string) => Promise<void>;
    onShowQuestionnaire: () => Promise<void>;
    onCloseQuestionnaire: () => void;
    onQuestionnaireSaved: (saved: PersonaSeedSavedEvent) => Promise<void>;
    onReconnect: () => Promise<void>;
    onExportSessionRecord: () => Promise<void>;
    onOpenConsole: () => Promise<void>;
    onStopInput: () => void;
    magiState: Ref<UseMagiReturn | null>;
}

/** provide/inject key for MagiRoot context */
export const MAGI_ROOT_CTX_KEY: InjectionKey<MagiRootContext> = Symbol("MagiRootContext");
