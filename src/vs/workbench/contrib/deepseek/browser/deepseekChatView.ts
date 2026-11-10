/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zovax AI. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE in the project root.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from 'vs/base/browser/dom';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IContextMenuService } from 'vs/base/browser/contextmenu';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IHoverService } from 'vs/platform/hover/browser/hover';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IViewPaneOptions, ViewPane } from 'vs/workbench/browser/parts/views/viewPane';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IDeepSeekAgentService } from 'vs/workbench/services/deepseek/common/deepseekAgentService';

/**
 * DeepSeek 原生聊天视图（M1 骨架）：workbench 原生控件渲染，不使用 webview。
 * 结构按 DSH 前端（packages/client 的 ui-chat / ui-conversation / ui-plan）移植：
 *   会话头（会话切换 + 模型）→ 消息流（气泡）→ 工作流时间线 → 输入区
 * M1 只落结构与事件订阅：消息渲染、思考折叠、工具卡片在 M1 后半段补齐。
 */
export class DeepSeekChatView extends ViewPane {
	static readonly ID = 'deepseek.chatView';

	private messageList: HTMLElement | undefined;
	private workflowList: HTMLElement | undefined;
	private inputBox: HTMLTextAreaElement | undefined;
	private currentSessionId: string | undefined;
	private promptCts: CancellationTokenSource | undefined;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IHoverService hoverService: IHoverService,
		@IDeepSeekAgentService private readonly agentService: IDeepSeekAgentService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		const root = append(container, $('div.deepseek-chat'));

		const header = append(root, $('div.deepseek-chat__header'));
		append(header, $('span.deepseek-chat__title')).textContent = 'DeepSeek';

		this.workflowList = append(root, $('ol.deepseek-chat__workflow'));
		this.messageList = append(root, $('div.deepseek-chat__messages'));

		const inputRow = append(root, $('div.deepseek-chat__input-row'));
		this.inputBox = append(inputRow, $('textarea.deepseek-chat__input')) as HTMLTextAreaElement;
		this.inputBox.placeholder = '给 DeepSeek 下达任务…（Enter 发送）';
		const sendButton = append(inputRow, $('button.deepseek-chat__send')) as HTMLButtonElement;
		sendButton.textContent = '发送';
		const onSend = () => { void this.sendCurrentInput(); };
		sendButton.addEventListener('click', onSend);
		this._register({ dispose: () => sendButton.removeEventListener('click', onSend) });
		const inputBox = this.inputBox;
		const onKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				void this.sendCurrentInput();
			}
		};
		inputBox.addEventListener('keydown', onKeydown);
		this._register({ dispose: () => inputBox.removeEventListener('keydown', onKeydown) });

		this._register(this.agentService.onSessionUpdate((update) => {
			if (update.kind === 'messageDelta') {
				this.appendMessage(update.role, update.text);
			}
			// TODO(M1): reasoningDelta 渲染为可折叠思考区；toolCall / planUpdate 渲染到 workflowList
		}));

		void this.ensureSession();
	}

	private async ensureSession(): Promise<void> {
		if (this.currentSessionId) {
			return;
		}
		const session = await this.agentService.createSession();
		this.currentSessionId = session.id;
	}

	private async sendCurrentInput(): Promise<void> {
		const text = this.inputBox?.value.trim();
		if (!text || !this.currentSessionId) {
			return;
		}
		this.appendMessage('user', text);
		if (this.inputBox) {
			this.inputBox.value = '';
		}
		this.promptCts?.dispose(true);
		this.promptCts = new CancellationTokenSource();
		await this.agentService.sendPrompt(this.currentSessionId, text, this.promptCts.token);
	}

	private appendMessage(role: 'user' | 'assistant', text: string): void {
		if (!this.messageList) {
			return;
		}
		const row = append(this.messageList, $(`div.deepseek-msg.deepseek-msg--${role}`));
		row.textContent = text;
	}

}
