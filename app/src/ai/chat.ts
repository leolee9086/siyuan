import {fetchPost, fetchStream} from "../util/fetch";
import {fillContent} from "./actions";
import {isMobile} from "../util/functions";
import {genUUID} from "../util/genID";

// 全局聊天面板管理
const chatPanels = new Map<string, any>();

export const openAIChat = (protyle: IProtyle) => {
    const panelId = `ai-chat-${protyle.id}`;
    
    // 如果已存在聊天面板，则显示它
    const existingPanel = chatPanels.get(panelId);
    if (existingPanel) {
        existingPanel.show();
        return;
    }

    const getCurrentNoteContent = () => {
        const wysiwygElement = protyle.wysiwyg.element;
        const blocks = wysiwygElement.querySelectorAll('[data-node-id]');
        let content = '';
        blocks.forEach((block: HTMLElement) => {
            const textContent = block.textContent || '';
            if (textContent.trim()) {
                content += textContent + '\n';
            }
        });
        return content.trim();
    };

    const getSelectedContent = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const selectedText = range.toString().trim();
            if (selectedText) {
                return selectedText;
            }
        }
        return '';
    };

    const getContextInfo = () => {
        const selectedContent = getSelectedContent();
        const noteContent = getCurrentNoteContent();
        const totalBlocks = protyle.wysiwyg.element.querySelectorAll('[data-node-id]').length;
        const selectedBlocks = protyle.wysiwyg.element.querySelectorAll('.protyle-wysiwyg--select').length;
        
        // 获取选中块的内容
        const getSelectedBlocksContent = () => {
            const selectedBlockElements = protyle.wysiwyg.element.querySelectorAll('.protyle-wysiwyg--select');
            let content = '';
            selectedBlockElements.forEach((block) => {
                const blockContent = block.textContent || '';
                if (blockContent.trim()) {
                    content += blockContent + '\n\n';
                }
            });
            return content.trim();
        };
        
        const selectedBlocksContent = getSelectedBlocksContent();
        
        return {
            selectedContent,
            noteContent,
            totalBlocks,
            selectedBlocks,
            selectedBlocksContent
        };
    };

    const createChatHTML = () => {
        const contextInfo = getContextInfo();
        const hasSelectedContent = contextInfo.selectedContent.length > 0;
        const hasSelectedBlocks = contextInfo.selectedBlocks > 0;
        let contextText = '';
        
        if (hasSelectedContent) {
            contextText = `选中内容: ${contextInfo.selectedContent.length}字符`;
        } else if (hasSelectedBlocks) {
            contextText = `选中块: ${contextInfo.selectedBlocks}个`;
        } else {
            contextText = `当前笔记: ${contextInfo.totalBlocks}个块`;
        }
        
        return `
            <div class="ai-chat-container" style="height: 100%; display: flex; flex-direction: column;">
                <!-- 上下文信息 -->
                <div class="ai-chat-context" style="
                    padding: 8px 12px;
                    background: var(--b3-theme-surface);
                    border-bottom: 1px solid var(--b3-border-color);
                    font-size: 12px;
                    color: var(--b3-theme-on-surface);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                ">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="ai-context-info">${contextText}</span>
                        ${hasSelectedBlocks ? `
                            <label class="ai-context-toggle" style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                                <input type="checkbox" class="ai-context-full-note" style="margin: 0;">
                                <span style="font-size: 11px; opacity: 0.8;">发送全笔记</span>
                            </label>
                        ` : ''}
                    </div>
                    <span class="ai-context-update" style="cursor: pointer; opacity: 0.6;" title="更新上下文">
                        <svg width="14" height="14"><use xlink:href="#iconRefresh"></use></svg>
                    </span>
                </div>
                
                <!-- 聊天消息区域 -->
                <div class="ai-chat-messages" style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                "></div>
                
                <!-- 输入区域 -->
                <div class="ai-chat-input" style="
                    padding: 12px;
                    border-top: 1px solid var(--b3-border-color);
                    background: var(--b3-theme-surface);
                ">
                    <div style="display: flex; gap: 8px; align-items: flex-end;">
                        <textarea class="ai-chat-textarea" placeholder="输入您的问题..." style="
                            flex: 1;
                            min-height: 60px;
                            max-height: 120px;
                            padding: 8px 12px;
                            border: 1px solid var(--b3-border-color);
                            border-radius: 4px;
                            background: var(--b3-theme-background);
                            color: var(--b3-theme-on-surface);
                            font-family: inherit;
                            font-size: 14px;
                            resize: vertical;
                            outline: none;
                        "></textarea>
                        <button class="ai-chat-send" style="
                            padding: 8px 16px;
                            background: var(--b3-theme-primary);
                            color: var(--b3-theme-on-primary);
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            white-space: nowrap;
                        ">发送</button>
                    </div>
                </div>
            </div>
        `;
    };

    // 创建聊天面板
    const panel = protyle.addCustomPanel({
        id: panelId,
        title: "AI 聊天助手",
        icon: "iconSparkles",
        content: createChatHTML(),
        height: "400px",
        minHeight: "300px",
        maxHeight: "600px"
    });

    // 获取面板元素
    const container = panel.contentElement.querySelector('.ai-chat-container') as HTMLElement;
    const messagesContainer = container.querySelector('.ai-chat-messages') as HTMLElement;
    const inputTextarea = container.querySelector('.ai-chat-textarea') as HTMLTextAreaElement;
    const sendButton = container.querySelector('.ai-chat-send') as HTMLButtonElement;
    const contextInfo = container.querySelector('.ai-context-info') as HTMLElement;
    const contextUpdate = container.querySelector('.ai-context-update') as HTMLElement;

    // 状态管理
    let isStreaming = false;
    let abortFunction: (() => void) | null = null;

    // 更新上下文信息
    const updateContextInfo = () => {
        const context = getContextInfo();
        const hasSelectedContent = context.selectedContent.length > 0;
        const hasSelectedBlocks = context.selectedBlocks > 0;
        let contextText = '';
        
        if (hasSelectedContent) {
            contextText = `选中内容: ${context.selectedContent.length}字符`;
        } else if (hasSelectedBlocks) {
            contextText = `选中块: ${context.selectedBlocks}个`;
        } else {
            contextText = `当前笔记: ${context.totalBlocks}个块`;
        }
        
        contextInfo.textContent = contextText;
        
        // 更新开关显示
        const contextContainer = contextInfo.parentElement as HTMLElement;
        const existingToggle = contextContainer.querySelector('.ai-context-toggle');
        
        if (hasSelectedBlocks && !existingToggle) {
            // 添加开关
            const toggleLabel = document.createElement('label');
            toggleLabel.className = 'ai-context-toggle';
            toggleLabel.style.cssText = 'display: flex; align-items: center; gap: 4px; cursor: pointer;';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'ai-context-full-note';
            checkbox.style.cssText = 'margin: 0;';
            
            const span = document.createElement('span');
            span.textContent = '发送全笔记';
            span.style.cssText = 'font-size: 11px; opacity: 0.8;';
            
            toggleLabel.appendChild(checkbox);
            toggleLabel.appendChild(span);
            contextContainer.appendChild(toggleLabel);
        } else if (!hasSelectedBlocks && existingToggle) {
            // 移除开关
            existingToggle.remove();
        }
    };

    // 添加消息
    const addMessage = (content: string, isUser: boolean = false, messageId?: string) => {
        const messageElement = document.createElement('div');
        messageElement.className = `ai-message ${isUser ? 'ai-message--user' : 'ai-message--assistant'}`;
        messageElement.setAttribute('data-message-id', messageId || genUUID());
        messageElement.style.cssText = `
            display: flex;
            gap: 8px;
            align-items: flex-start;
            ${isUser ? 'flex-direction: row-reverse;' : ''}
        `;

        const avatar = document.createElement('div');
        avatar.className = 'ai-message-avatar';
        avatar.style.cssText = `
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            font-size: 16px;
            ${isUser ? 
                'background: var(--b3-theme-primary); color: var(--b3-theme-on-primary);' : 
                'background: var(--b3-theme-surface); color: var(--b3-theme-on-surface);'
            }
        `;
        avatar.innerHTML = isUser ? '👤' : '🤖';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'ai-message-content';
        contentDiv.style.cssText = `
            flex: 1;
            padding: 12px;
            border-radius: 8px;
            max-width: 80%;
            word-wrap: break-word;
            white-space: pre-wrap;
            ${isUser ? 
                'background: var(--b3-theme-primary); color: var(--b3-theme-on-primary);' : 
                'background: var(--b3-theme-surface); color: var(--b3-theme-on-surface); border: 1px solid var(--b3-border-color);'
            }
        `;
        contentDiv.textContent = content;

        messageElement.appendChild(avatar);
        messageElement.appendChild(contentDiv);

        // 如果是AI回复，添加追加按钮
        if (!isUser) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'ai-message-actions';
            actionsDiv.style.cssText = `
                display: flex;
                gap: 4px;
                margin-top: 8px;
                justify-content: flex-start;
            `;

            const appendButton = document.createElement('button');
            appendButton.textContent = '追加到笔记';
            appendButton.className = 'ai-append-button';
            appendButton.style.cssText = `
                padding: 6px 12px;
                background: var(--b3-theme-primary);
                color: var(--b3-theme-on-primary);
                border: none;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: background-color 0.2s;
            `;
            appendButton.addEventListener('click', () => {
                appendToNote(messageElement.getAttribute('data-message-id')!);
            });

            actionsDiv.appendChild(appendButton);
            contentDiv.appendChild(actionsDiv);
        }

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return messageElement;
    };

    // 更新AI消息内容，保留追加按钮
    const updateAIMessageContent = (messageElement: HTMLElement, content: string) => {
        const contentElement = messageElement.querySelector('.ai-message-content') as HTMLElement;
        if (!contentElement) return;
        
        // 获取消息ID
        const messageId = messageElement.getAttribute('data-message-id');
        if (!messageId) return;
        
        // 保存追加按钮的引用（如果存在）
        const existingActionsDiv = contentElement.querySelector('.ai-message-actions');
        
        // 清空内容区域
        contentElement.innerHTML = '';
        
        // 添加文本内容
        const textNode = document.createTextNode(content);
        contentElement.appendChild(textNode);
        
        // 重新创建追加按钮
        const newActionsDiv = document.createElement('div');
        newActionsDiv.className = 'ai-message-actions';
        newActionsDiv.style.cssText = `
            display: flex;
            gap: 4px;
            margin-top: 8px;
            justify-content: flex-start;
        `;

        const appendButton = document.createElement('button');
        appendButton.textContent = '追加到笔记';
        appendButton.className = 'ai-append-button';
        appendButton.style.cssText = `
            padding: 6px 12px;
            background: var(--b3-theme-primary);
            color: var(--b3-theme-on-primary);
            border: none;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            transition: background-color 0.2s;
        `;
        
        // 重新绑定事件监听器
        appendButton.addEventListener('click', () => {
            console.log('追加按钮被点击，消息ID:', messageId);
            appendToNote(messageId);
        });

        newActionsDiv.appendChild(appendButton);
        contentElement.appendChild(newActionsDiv);
    };

    // 追加到笔记
    const appendToNote = (messageId: string) => {
        console.log('appendToNote 被调用，消息ID:', messageId);
        
        const messageElement = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) {
            console.log('未找到消息元素');
            return;
        }

        const contentElement = messageElement.querySelector('.ai-message-content') as HTMLElement;
        if (!contentElement) {
            console.log('未找到内容元素');
            return;
        }
        
        const content = contentElement.textContent || '';
        console.log('要追加的内容:', content.substring(0, 100) + '...');
        
        if (content) {
            try {
                // 获取当前光标位置或文档末尾
                const wysiwygElement = protyle.wysiwyg.element;
                const blocks = wysiwygElement.querySelectorAll('[data-node-id]');
                
                if (blocks.length > 0) {
                    // 使用最后一个块作为插入位置
                    const lastBlock = blocks[blocks.length - 1] as HTMLElement;
                    const elements = [lastBlock];
                    
                    fillContent(protyle, content, elements);
                    console.log('内容已成功追加到笔记');
                    
                    // 显示成功提示
                    const button = messageElement.querySelector('.ai-append-button') as HTMLButtonElement;
                    if (button) {
                        const originalText = button.textContent;
                        button.textContent = '已追加';
                        button.style.background = 'var(--b3-theme-success)';
                        button.disabled = true;
                        
                        setTimeout(() => {
                            button.textContent = originalText;
                            button.style.background = 'var(--b3-theme-primary)';
                            button.disabled = false;
                        }, 2000);
                    }
                } else {
                    console.log('未找到可插入内容的块');
                }
            } catch (error) {
                console.error('追加到笔记时出错:', error);
            }
        } else {
            console.log('内容为空，无法追加');
        }
    };

    // 发送消息
    const sendMessage = () => {
        const inputValue = inputTextarea.value.trim();
        if (!inputValue || isStreaming) return;

        // 添加用户消息
        addMessage(inputValue, true);
        inputTextarea.value = '';

        // 添加AI消息占位符
        const aiMessageElement = addMessage('正在思考...', false);
        const aiContentElement = aiMessageElement.querySelector('.ai-message-content') as HTMLElement;

        // 更新按钮状态
        sendButton.textContent = '生成中...';
        sendButton.disabled = true;
        inputTextarea.disabled = true;

        isStreaming = true;
        let responseContent = '';

        // 获取上下文
        const context = getContextInfo();
        const fullNoteToggle = container.querySelector('.ai-context-full-note') as HTMLInputElement;
        
        let prompt = '';
        if (context.selectedContent) {
            // 有文字选择，优先使用文字选择
            prompt = `基于以下选中内容回答问题：\n\n${context.selectedContent}\n\n问题：${inputValue}`;
        } else if (context.selectedBlocks > 0) {
            // 有块选择
            if (fullNoteToggle && fullNoteToggle.checked) {
                // 发送全笔记，但强调选中的块
                prompt = `基于以下笔记内容回答问题，特别注意以下选中的${context.selectedBlocks}个块：\n\n${context.noteContent}\n\n选中的块内容：\n${context.selectedBlocksContent}\n\n问题：${inputValue}`;
            } else {
                // 只发送选中的块
                prompt = `基于以下选中块内容回答问题：\n\n${context.selectedBlocksContent}\n\n问题：${inputValue}`;
            }
        } else {
            // 没有选择，使用全笔记
            prompt = `基于以下笔记内容回答问题：\n\n${context.noteContent}\n\n问题：${inputValue}`;
        }

        fetchStream(
            { msg: prompt },
            (contentChunk) => {
                if (isStreaming) {
                responseContent += contentChunk;
                    // 更新AI消息内容，保留追加按钮
                    updateAIMessageContent(aiMessageElement, responseContent);
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            },
            () => {
                isStreaming = false;
                sendButton.textContent = '发送';
                sendButton.disabled = false;
                inputTextarea.disabled = false;
                inputTextarea.focus();
                abortFunction = null;
            },
            (error) => {
                isStreaming = false;
                updateAIMessageContent(aiMessageElement, `生成失败: ${error.message}`);
                aiContentElement.style.color = 'var(--b3-theme-error)';
                sendButton.textContent = '发送';
                sendButton.disabled = false;
                inputTextarea.disabled = false;
                abortFunction = null;
            },
            () => {
                isStreaming = false;
                updateAIMessageContent(aiMessageElement, '已终止响应');
                sendButton.textContent = '发送';
                sendButton.disabled = false;
                inputTextarea.disabled = false;
                abortFunction = null;
            }
        ).then((abortFn) => {
            abortFunction = abortFn;
        });
    };

    // 绑定事件
    sendButton.addEventListener('click', sendMessage);
    inputTextarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    // 更新上下文按钮
    contextUpdate.addEventListener('click', updateContextInfo);

    // 监听Protyle内容变化，自动更新上下文
    const observer = new MutationObserver(() => {
        updateContextInfo();
    });
    observer.observe(protyle.wysiwyg.element, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // 监听Protyle中的块选择和文字选择变化
    const handleProtyleSelectionChange = () => {
        // 延迟更新，避免频繁触发
        clearTimeout((window as any).aiContextUpdateTimeout);
        (window as any).aiContextUpdateTimeout = setTimeout(() => {
            updateContextInfo();
        }, 100);
    };
    
    // 监听块选择变化（通过MutationObserver监听protyle-wysiwyg--select类的变化）
    const blockSelectionObserver = new MutationObserver((mutations) => {
        let hasSelectionChange = false;
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target as HTMLElement;
                if (target.classList.contains('protyle-wysiwyg--select') || 
                    target.classList.contains('protyle-wysiwyg--select') === false) {
                    hasSelectionChange = true;
                }
            } else if (mutation.type === 'childList') {
                // 检查新增或删除的节点是否有选择类
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as HTMLElement;
                        if (element.classList.contains('protyle-wysiwyg--select')) {
                            hasSelectionChange = true;
                        }
                    }
                });
                mutation.removedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as HTMLElement;
                        if (element.classList.contains('protyle-wysiwyg--select')) {
                            hasSelectionChange = true;
                        }
                    }
                });
            }
        });
        
        if (hasSelectionChange) {
            handleProtyleSelectionChange();
        }
    });
    
    // 监听Protyle元素内的所有变化
    blockSelectionObserver.observe(protyle.wysiwyg.element, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
    });
    
    // 监听文字选择变化（只在Protyle内）
    const handleTextSelectionChange = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            // 只处理Protyle内的文字选择变化
            if (protyle.wysiwyg.element.contains(range.startContainer) || 
                protyle.wysiwyg.element.contains(range.endContainer)) {
                handleProtyleSelectionChange();
            }
        }
    };
    
    // 监听文字选择变化事件
    document.addEventListener('selectionchange', handleTextSelectionChange);
    
    // 防止聊天界面聚焦时取消块选择
    const preventFocusoutClearSelection = (event: FocusEvent) => {
        // 检查焦点是否从Protyle转移到聊天界面
        const relatedTarget = event.relatedTarget as HTMLElement;
        if (relatedTarget && panel.element.contains(relatedTarget)) {
            // 如果焦点转移到聊天界面，阻止清除选择
            event.stopPropagation();
            event.preventDefault();
        }
    };
    
    // 监听Protyle的focusout事件
    protyle.wysiwyg.element.addEventListener('focusout', preventFocusoutClearSelection, true);

    // 保存面板引用
    chatPanels.set(panelId, panel);

    // 面板销毁时清理
    panel.setDestroyCallback(() => {
        observer.disconnect();
        blockSelectionObserver.disconnect();
        document.removeEventListener('selectionchange', handleTextSelectionChange);
        protyle.wysiwyg.element.removeEventListener('focusout', preventFocusoutClearSelection, true);
        chatPanels.delete(panelId);
    });

    // 显示面板
    panel.show();
};