<template>
    <div :class="{ 'pdf__outer': true, 'pdf__outer--dark': pdfTheme === 'dark' }" id="outerContainer">
        <!--注意,任何一个有ID的元素都有可能影响pdfjs浏览器控制器的工作,所以需要特别小心 -->
        <div id="sidebarContainer">
            <div id="toolbarSidebar">
                <div id="toolbarSidebarLeft">
                    <button id="viewThumbnail" class="toolbarButton toggled b3-tooltips b3-tooltips__ne"
                        :aria-label="siyuanI18n.thumbsTitle">
                        <svg>
                            <use xlink:href="#iconImage"></use>
                        </svg>
                    </button>
                    <button id="viewOutline" class="toolbarButton b3-tooltips b3-tooltips__ne"
                        :aria-label="siyuanI18n.outline">
                        <svg>
                            <use xlink:href="#iconOutline"></use>
                        </svg>
                    </button>
                    <button id="viewAttachments" class="toolbarButton fn__none" data-l10n-id="attachments">
                        <span data-l10n-id="attachments_label">Attachments</span>
                    </button>
                    <button id="viewLayers" class="toolbarButton fn__none" data-l10n-id="layers">
                        <span data-l10n-id="layers_label">Layers</span>
                    </button>
                </div>
                <div class="fn__flex-1"></div>
                <div id="toolbarSidebarRight">
                    <div id="outlineOptionsContainer" class="fn__hidden">
                        <button id="currentOutlineItem" class="toolbarButton b3-tooltips b3-tooltips__nw"
                            disabled="true" :aria-label="siyuanI18n.focusOutline">
                            <svg>
                                <use xlink:href="#iconFocus"></use>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            <div id="sidebarContent">
                <div id="thumbnailView">
                </div>
                <div id="outlineView" class="fn__hidden">
                </div>
                <div id="attachmentsView" class="fn__hidden">
                </div>
                <div id="layersView" class="fn__hidden">
                </div>
            </div>
            <div id="sidebarResizer"></div>
        </div>
        <div id="mainContainer">
            <div class="findbar b3-menu fn__hidden doorHanger" id="findbar">
                <input id="findInput" class="toolbarField b3-text-field" :placeholder="siyuanI18n.search">
                <div class="fn__space"></div>
                <button id="findPreviousButton" class="toolbarButton findPrevious b3-tooltips b3-tooltips__n"
                    :aria-label="siyuanI18n.previous">
                    <svg>
                        <use xlink:href="#iconUp"></use>
                    </svg>
                </button>
                <button id="findNextButton" class="toolbarButton findNext b3-tooltips b3-tooltips__n"
                    :aria-label="siyuanI18n.next">
                    <svg>
                        <use xlink:href="#iconDown"></use>
                    </svg>
                </button>
                <label class="b3-button b3-button--outline b3-button--small">
                    <input type="checkbox" id="findHighlightAll" class="toolbarField">
                    {{ siyuanI18n.findHighlight }}
                </label>
                <div class="fn__space"></div>
                <label class="b3-button b3-button--outline b3-button--small">
                    <input type="checkbox" id="findMatchCase" class="toolbarField">
                    {{ siyuanI18n.searchCaseSensitive }}
                </label>
                <div class="fn__space"></div>
                <label class="b3-button b3-button--outline b3-button--small">
                    <input type="checkbox" id="findMatchDiacritics" class="toolbarField">
                    {{ siyuanI18n.matchDiacritics }}
                </label>
                <div class="fn__space"></div>
                <label class="b3-button b3-button--outline b3-button--small">
                    <input type="checkbox" id="findEntireWord" class="toolbarField">
                    {{ siyuanI18n.findEntireWord }}
                </label>
                <div class="fn__space"></div>
                <span id="findResultsCount" class="b3-button b3-button--small b3-button--cancel"></span>
                <span id="findMsg" class="b3-button b3-button--small b3-button--cancel"></span>
            </div> <!-- findbar -->
            <div id="secondaryToolbar" class="secondaryToolbar fn__hidden doorHangerRight b3-menu">
                <div id="secondaryToolbarButtonContainer" class="b3-menu__items">
                    <button id="pdfLight" class="secondaryToolbarButton b3-menu__item toggled">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconLight"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.themeLight }}</span>
                    </button>
                    <button id="pdfDark" class="secondaryToolbarButton b3-menu__item">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconDark"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.themeDark }}</span>
                    </button>
                    <div class="horizontalToolbarSeparator b3-menu__separator"></div>
                    <button id="previous" class="secondaryToolbarButton b3-menu__item pageUp">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconUp"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.previousLabel }}</span>
                        <span class="b3-menu__accelerator b3-menu__accelerator--hotkey">{{ updateHotkeyTip("P") }}/{{
                            updateHotkeyTip("K") }}</span>
                    </button>
                    <button id="next" class="secondaryToolbarButton b3-menu__item pageDown">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconDown"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.nextLabel }}</span>
                        <span class="b3-menu__accelerator b3-menu__accelerator--hotkey">{{ updateHotkeyTip("J") }}/{{
                            updateHotkeyTip("N") }}</span>
                    </button>
                    <button id="firstPage" class="secondaryToolbarButton b3-menu__item firstPage">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconBack"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.firstPage }}</span>
                        <span class="b3-menu__accelerator b3-menu__accelerator--hotkey">Home</span>
                    </button>
                    <button id="lastPage" class="secondaryToolbarButton b3-menu__item lastPage">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconForward"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.lastPage }}</span>
                        <span class="b3-menu__accelerator b3-menu__accelerator--hotkey">End</span>
                    </button>
                    <div class="horizontalToolbarSeparator b3-menu__separator"></div>
                    <button id="zoomOutButton" class="secondaryToolbarButton b3-menu__item zoomOut">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconLine"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.zoomOut }}</span>
                        <span class="b3-menu__accelerator b3-menu__accelerator--hotkey">{{ updateHotkeyTip("⌘-")
                        }}</span>
                    </button>
                    <button id="zoomInButton" class="secondaryToolbarButton b3-menu__item zoomIn">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconAdd"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.zoomIn }}</span>
                        <span class="b3-menu__accelerator b3-menu__accelerator--hotkey">{{ updateHotkeyTip("⌘=")
                        }}</span>
                    </button>
                    <button id="pageRotateCw" class="secondaryToolbarButton b3-menu__item rotateCw">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconRedo"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.rotateCw }}</span>
                        <span class="b3-menu__accelerator b3-menu__accelerator--hotkey">R</span>
                    </button>
                    <button id="pageRotateCcw" class="secondaryToolbarButton b3-menu__item rotateCcw">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconUndo"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.rotateCcw }}</span>
                        <span class="b3-menu__accelerator b3-menu__accelerator--hotkey">{{ updateHotkeyTip("⇧R")
                        }}</span>
                    </button>

                    <div class="horizontalToolbarSeparator b3-menu__separator"></div>

                    <button id="cursorSelectTool" class="secondaryToolbarButton b3-menu__item selectTool toggled">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconSelectText"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.cursorText }}</span>
                        <span class="b3-menu__accelerator b3-menu__accelerator--hotkey">S</span>
                    </button>
                    <button id="cursorHandTool" class="secondaryToolbarButton b3-menu__item handTool">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconHand"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.cursorHand }}</span>
                        <span class="b3-menu__accelerator b3-menu__accelerator--hotkey">H</span>
                    </button>
                    <div class="horizontalToolbarSeparator b3-menu__separator"></div>
                    <button id="scrollVertical"
                        class="secondaryToolbarButton b3-menu__item scrollModeButtons scrollVertical toggled">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconScrollVert"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.scrollVertical }}</span>
                    </button>
                    <button id="scrollHorizontal"
                        class="secondaryToolbarButton b3-menu__item scrollModeButtons scrollHorizontal">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconScrollHoriz"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.scrollHorizontal }}</span>
                    </button>
                    <button id="scrollWrapped"
                        class="secondaryToolbarButton b3-menu__item scrollModeButtons scrollWrapped">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconScrollWrapped"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.scrollWrapped }}</span>
                    </button>

                    <div class="horizontalToolbarSeparator b3-menu__separator scrollModeButtons"></div>

                    <button id="spreadNone"
                        class="secondaryToolbarButton b3-menu__item spreadModeButtons spreadNone toggled">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconFile"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.spreadNone }}</span>
                    </button>
                    <button id="spreadOdd" class="secondaryToolbarButton b3-menu__item spreadModeButtons spreadOdd">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconSpreadOdd"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.spreadOdd }}</span>
                    </button>
                    <button id="spreadEven" class="secondaryToolbarButton b3-menu__item spreadModeButtons spreadEven">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconSpreadEven"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.spreadEven }}</span>
                    </button>
                    <button id="presentationMode" class="secondaryToolbarButton b3-menu__item presentationMode">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconPlay"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.presentationMode }}</span>
                        <span class="b3-menu__accelerator b3-menu__accelerator--hotkey">${updateHotkeyTip("⌥⌘P")}</span>
                    </button>
                    <div class="horizontalToolbarSeparator b3-menu__separator spreadModeButtons"></div>
                    <button id="documentProperties" class="secondaryToolbarButton b3-menu__item documentProperties">
                        <svg class="b3-menu__icon">
                            <use xlink:href="#iconInfo"></use>
                        </svg>
                        <span class="b3-menu__label">{{ siyuanI18n.attr }}</span>
                    </button>
                </div>
            </div> <!-- secondaryToolbar -->

            <div class="pdf__toolbar">
                <div id="toolbarContainer">
                    <div id="toolbarViewer">
                        <button id="sidebarToggleButton" class="toolbarButton b3-tooltips b3-tooltips__se"
                            aria-expanded="false" aria-controls="sidebarContainer"
                            :aria-label="siyuanI18n.toggleSidebarNotification2Title + '' + updateHotkeyTip('F4')">
                            <svg>
                                <use xlink:href="#iconLayoutLeft"></use>
                            </svg>
                        </button>
                        <button id="viewFindButton" class="toolbarButton b3-tooltips b3-tooltips__se"
                            aria-expanded="false" aria-controls="findbar"
                            :aria-label="siyuanI18n.search + '' + updateHotkeyTip('⌘F')">
                            <svg>
                                <use xlink:href="#iconSearch"></use>
                            </svg>
                        </button>
                        <button id="rectAnno" class="toolbarButton b3-tooltips b3-tooltips__se" aria-expanded="false"
                            aria-controls="findbar"
                            :aria-label="siyuanI18n.rectAnnotation + '' + updateHotkeyTip('⌘D') + '' + updateHotkeyTip('⌥D')">
                            <svg>
                                <use xlink:href="#iconLeftTop"></use>
                            </svg>
                        </button>
                        <input type="number" id="pageNumber" class="toolbarField pageNumber b3-text-field" value="1"
                            size="4" min="1" autocomplete="off">
                        <span id="numPages"></span>
                        <div class="fn__flex-1"></div>
                        <span id="scaleSelectContainer" class="dropdownToolbarButton">
                            <select id="scaleSelect" class="b3-select">
                                <option id="pageAutoOption" value="auto" selected="true">{{ siyuanI18n.pageScaleAuto }}
                                </option>
                                <option id="pageActualOption" value="page-actual">{{ siyuanI18n.pageScaleActual }}
                                </option>
                                <option id="pageFitOption" value="page-fit">{{ siyuanI18n.pageScaleFit }}</option>
                                <option id="pageWidthOption" value="page-width">{{ siyuanI18n.pageScaleWidth }}</option>
                                <option id="customScaleOption" value="custom" disabled="true" hidden="true">
                                </option>
                                <option value="0.5">50%</option>
                                <option value="0.75">75%</option>
                                <option value="1">100%</option>
                                <option value="1.25">125%</option>
                                <option value="1.5">150%</option>
                                <option value="2">200%</option>
                                <option value="3">300%</option>
                                <option value="4">400%</option>
                            </select>
                        </span>
                        <span id="scrollPage" class="fn__none"></span>
                        <span id="printButton" class="fn__none"></span>
                        <span id="secondaryPrint" class="fn__none"></span>
                        <span id="viewBookmark" class="fn__none"></span>
                        <span id="secondaryViewBookmark" class="fn__none"></span>
                        <button id="secondaryToolbarToggleButton" class="toolbarButton b3-tooltips b3-tooltips__sw"
                            :aria-label="siyuanI18n.more" aria-expanded="false" aria-controls="secondaryToolbar">
                            <svg>
                                <use xlink:href="#iconMore"></use>
                            </svg>
                        </button>
                    </div>
                    <div id="loadingBar">
                        <div class="progress">
                            <div class="glimmer">
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="viewerContainer">
                <div id="viewer" class="pdfViewer"></div>
                <div class="pdf__resize fn__none"></div>
            </div>
            <div id="errorWrapper" hidden='true'>
                <div id="errorMessageLeft">
                    <span id="errorMessage"></span>
                    <button id="errorShowMore" data-l10n-id="error_more_info">
                        More Information
                    </button>
                    <button id="errorShowLess" data-l10n-id="error_less_info" hidden='true'>
                        Less Information
                    </button>
                </div>
                <div id="errorMessageRight">
                    <button id="errorClose" data-l10n-id="error_close">
                        Close
                    </button>
                </div>
                <div class="clearBoth"></div>
                <textarea id="errorMoreInfo" hidden='true' readonly="true"></textarea>
            </div>
        </div>
        <div id="dialogContainer">
            <div class="dialog" id="passwordDialog">
                <div class="row">
                    <p id="passwordText" data-l10n-id="password_label">Enter the password to open this PDF file:</p>
                </div>
                <div class="row">
                    <input type="password" id="password" class="toolbarField">
                </div>
                <div class="buttonRow">
                    <button id="passwordCancel" class="overlayButton"><span
                            data-l10n-id="password_cancel">Cancel</span></button>
                    <button id="passwordSubmit" class="overlayButton"><span
                            data-l10n-id="password_ok">OK</span></button>
                </div>
            </div>
            <div class="dialog" id="documentPropertiesDialog">
                <div class="row">
                    <span>{{ siyuanI18n.fileName }}</span>
                    <p id="fileNameField">-</p>
                </div>
                <div class="row">
                    <span>{{ siyuanI18n.fileSize }}</span>
                    <p id="fileSizeField">-</p>
                </div>
                <div class="separator"></div>
                <div class="row">
                    <span>{{ siyuanI18n.title1 }}</span>
                    <p id="titleField">-</p>
                </div>
                <div class="row">
                    <span>{{ siyuanI18n.author }}</span>
                    <p id="authorField">-</p>
                </div>
                <div class="row">
                    <span>{{ siyuanI18n.subject }}</span>
                    <p id="subjectField">-</p>
                </div>
                <div class="row">
                    <span>{{ siyuanI18n.keywords }}</span>
                    <p id="keywordsField">-</p>
                </div>
                <div class="row">
                    <span>{{ siyuanI18n.creationDate }}</span>
                    <p id="creationDateField">-</p>
                </div>
                <div class="row">
                    <span>{{ siyuanI18n.modificationDate }}</span>
                    <p id="modificationDateField">-</p>
                </div>
                <div class="row">
                    <span>{{ siyuanI18n.creator }}</span>
                    <p id="creatorField">-</p>
                </div>
                <div class="separator"></div>
                <div class="row">
                    <span>PDF {{ siyuanI18n.producer }}</span>
                    <p id="producerField">-</p>
                </div>
                <div class="row">
                    <span>PDF {{ siyuanI18n.version }}</span>
                    <p id="versionField">-</p>
                </div>
                <div class="row">
                    <span>{{ siyuanI18n.pageCount }}</span>
                    <p id="pageCountField">-</p>
                </div>
                <div class="row">
                    <span>{{ siyuanI18n.pageSize }}</span>
                    <p id="pageSizeField">-</p>
                </div>
                <div class="separator"></div>
                <div class="row">
                    <span>{{ siyuanI18n.linearized }}</span>
                    <p id="linearizedField">-</p>
                </div>
                <div class="buttonRow">
                    <button id="documentPropertiesClose" class="b3-button"><span>{{ siyuanI18n.close }}</span></button>
                </div>
            </div>
            <div class="dialog" id="printServiceOverlay">
                <div class="row">
                    <span data-l10n-id="print_progress_message">Preparing document for printing…</span>
                </div>
                <div class="row">
                    <progress value="0" max="100"></progress>
                    <span data-l10n-id="print_progress_percent" data-l10n-args='{ "progress": 0 }'
                        class="relative-progress">0%</span>
                </div>
                <div class="buttonRow">
                    <button id="printCancel" class="overlayButton"><span
                            data-l10n-id="print_progress_close">Cancel</span></button>
                </div>
            </div>
        </div>
        <div class="pdf__util b3-menu fn__none pdf__util--hide">
            <div class="fn__flex" style="padding: 0 4px;max-width: 300px;overflow-x: scroll;"
                v-on:wheel="(event) => horizontalScroll(event)">
                <template v-for="(colorValue, colorName) in genThemedColorList()">
                    <button @scroll.prevent class="color__square ariaLabel" :aria-label="colorName.toString() || ''"
                        :style="{ minWidth: '26px', minHeight: '26px', backgroundColor: 'var(' + colorValue + ')' }">
                    </button>
                </template>

            </div>
            <div class="b3-menu__separator" style="margin-top: 8px"></div>
            <button class="b3-menu__item pdf__util__hide" data-type="toggle">
                <svg class="b3-menu__icon">
                    <use xlink:href="#iconPaintBucket"></use>
                </svg>
                <span class="b3-menu__label">{{ siyuanI18n.showHideBg }}</span>
            </button>
            <button class="b3-menu__item pdf__util__hide" data-type="copy">
                <svg class="b3-menu__icon">
                    <use xlink:href="#iconRef"></use>
                </svg>
                <span class="b3-menu__label">{{ siyuanI18n.copyAnnotation }}</span>
            </button>
            <button class="b3-menu__item pdf__util__hide" data-type="relate">
                <svg class="b3-menu__icon">
                    <use xlink:href="#iconParagraph"></use>
                </svg>
                <span class="b3-menu__label">{{ siyuanI18n.relation }}</span>
            </button>
            <button class="b3-menu__item pdf__util__hide" data-type="download">
                <svg class="b3-menu__icon">
                    <use xlink:href="#iconDownload"></use>
                </svg>
                <span class="b3-menu__label">{{ siyuanI18n.download }}</span>
            </button>
            <button class="b3-menu__item" data-type="export-page">
                <svg class="b3-menu__icon">
                    <use xlink:href="#iconImage"></use>
                </svg>
                <span class="b3-menu__label">导出本页为图片</span>
            </button>
            <button class="b3-menu__item pdf__util__hide" data-type="remove">
                <svg class="b3-menu__icon">
                    <use xlink:href="#iconTrashcan"></use>
                </svg>
                <span class="b3-menu__label">{{ siyuanI18n.remove }}</span>
            </button>
        </div>
        <div class="fn__none">
            <input id="editorFreeTextFontSize">
            <input id="editorFreeTextColor">
            <input id="editorInkColor">
            <input id="editorInkThickness">
            <input id="editorInkOpacity">
            <input id="editorStampAddImage">
            <input id="editorFreeHighlightThickness">
            <input id="editorHighlightShowAll">
            <input id="downloadButton">
            <input id="secondaryDownload">
            <input id="editorFreeTextButton">
            <input id="openFile">
            <input id="editorInkButton">
            <input id="editorStampButton">
            <input id="editorHighlightButton">
            <input id="imageAltTextSettings">
            <input id="secondaryOpenFile">
        </div>
    </div> <!-- outerContainer -->
    <div id="printContainer"></div>
</template>
<script setup lang="ts">
import { Constants } from "../constants";
import { isElectron } from "../platform";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig, getSiyuanStorage } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { setStorageVal } from "../protyle/util/compatibility";
//@ts-ignore
import { webViewerLoad } from "../asset/pdf/viewer";
import {setModelsHash} from "../window/modelHash/setModelsHash";

import { updateHotkeyTip } from "../protyle/util/compatibility";
import { onMounted, ref } from "vue";
import { nextTick } from "vue";
import { genThemedColorList } from "../appearance/colorList";
import { horizontalScroll } from "../util/DOM/helpers/scroll";

const props = defineProps([
    "controller"
]);
const pdfTheme = ref("dark");

const controller = props.controller;
onMounted(
    async () => {
        await nextTick(() => { });
        const localPDF = getSiyuanStorage()[Constants.LOCAL_PDFTHEME];
        pdfTheme.value = getSiyuanConfig().appearance.mode === 0 ? localPDF.light : localPDF.dark;
        const darkElement = controller.element.querySelector("#pdfDark");
        const lightElement = controller.element.querySelector("#pdfLight");
        if (pdfTheme.value === "dark") {
            controller.element.firstElementChild.classList.add("pdf__outer--dark");
            lightElement.classList.remove("toggled");
            darkElement.classList.add("toggled");
        } else {
            lightElement.classList.add("toggled");
            darkElement.classList.remove("toggled");
        }
        lightElement.addEventListener("click", () => {
            if (getSiyuanConfig().appearance.mode === 0) {
                localPDF.light = "light";
            } else {
                localPDF.dark = "light";
            }
            controller.element.firstElementChild.classList.remove("pdf__outer--dark");
            lightElement.classList.add("toggled");
            darkElement.classList.remove("toggled");
            setStorageVal(Constants.LOCAL_PDFTHEME, getSiyuanStorage()[Constants.LOCAL_PDFTHEME]);
        });
        darkElement.addEventListener("click", () => {
            if (getSiyuanConfig().appearance.mode === 0) {
                localPDF.light = "dark";
            } else {
                localPDF.dark = "dark";
            }
            controller.element.firstElementChild.classList.add("pdf__outer--dark");
            lightElement.classList.remove("toggled");
            darkElement.classList.add("toggled");
            setStorageVal(Constants.LOCAL_PDFTHEME, getSiyuanStorage()[Constants.LOCAL_PDFTHEME]);
        });
        // 初始化完成后需等待页签是否显示设置完成，才可以判断 pdf 是否能进行渲染
        setTimeout(() => {
            const baseURLElement = document.getElementById("baseURL");
            if (!baseURLElement) {
                console.error("DOM中缺少baseURL元素，无法加载PDF文件");
                return;
            }
            if (controller.element.clientWidth === 0) {
                const observer = new MutationObserver(() => {
                    controller.pdfObject = webViewerLoad(
                        controller.path.startsWith("file") ? controller.path : baseURLElement.getAttribute("href") + "/" + controller.path,
                        controller.element, controller.pdfPage, controller.pdfId);
                    controller.element.setAttribute("data-loading", "true");
                    observer.disconnect();
                });
                observer.observe(controller.element, { attributeFilter: ["class"] });
            } else {
                controller.pdfObject = webViewerLoad(controller.path.startsWith("file") ? controller.path : baseURLElement.getAttribute("href") + "/" + controller.path,
                    controller.element, controller.pdfPage, controller.pdfId);
                controller.element.setAttribute("data-loading", "true");
            }
            if (isElectron) {
                setModelsHash();
            }


        }, Constants.TIMEOUT_LOAD);

    }
);
</script>
