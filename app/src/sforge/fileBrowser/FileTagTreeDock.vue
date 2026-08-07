<template>
    <FileTagTreePanel :count-repository="countRepository"
        :definitions-repository="definitionsRepository" :event-bus="props.app.eventBus"
        @open-tag="openTagResults" @open-notes="openTagNotes" />
</template>

<script setup lang="ts">
/** 用途：标签树的独立 Dock 宿主；使用范围：资源管理侧栏的标签面板。 */
import FileTagTreePanel from "./FileTagTreePanel.vue";
import {fileTagCountRepository, fileTagDefinitionsRepository} from "./FileTags.repository";
import type {AppFacade} from "./dock/imports";
import type {FileTagCountRepository, FileTagDefinitionsRepository} from "./FileTags.types";

const props = defineProps<{
    app: AppFacade;
    countRepository?: FileTagCountRepository;
    definitionsRepository?: FileTagDefinitionsRepository;
}>();
const countRepository = props.countRepository ?? fileTagCountRepository;
const definitionsRepository = props.definitionsRepository ?? fileTagDefinitionsRepository;

function openTagResults(tag: string) {
    void props.app.openTab({
        custom: {
            title: `标签: ${tag}`,
            icon: "iconTags",
            id: "sforge-file-gallery",
            data: {
                rootID: "workspace", path: "", name: `标签: ${tag}`,
                query: {allRoots: true, tags: [tag], matchAllTags: true, orderBy: "updated"},
            },
        },
    });
}

function openTagNotes(tag: string) {
    props.app.openGlobalSearch(`#${tag}#`, false, {method: 0});
}
</script>
