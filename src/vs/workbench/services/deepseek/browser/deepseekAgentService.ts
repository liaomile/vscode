/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zovax AI. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE in the project root.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { Disposable } from 'vs/base/common/lifecycle';
import { Emitter } from 'vs/base/common/event';
import { IDeepSeekAgentService } from 'vs/workbench/services/deepseek/common/deepseekAgentService';
import { IDeepSeekApprovalAnswer, IDeepSeekSession, DeepSeekSessionUpdate } from 'vs/workbench/contrib/deepseek/common/deepseekTypes';

/**
 * IDeepSeekAgentService 的 workbench 侧实现（M1 骨架）。
 *
 * 待接（M2）：经 IPC 通道连接 Agent Host 进程，Agent Host 以 ACP 驱动 DSH：
 *   createSession  -> ACP session/new
 *   sendPrompt     -> ACP session/prompt（更新经 session/update 通知回流为 DeepSeekSessionUpdate）
 *   answerApproval -> ACP session request_permission 的应答
 *   cancel         -> ACP session/cancel
 * 在通道接通前，本实现只维护本地会话表并发出空更新，保证视图层可先行联调渲染。
 */
export class DeepSeekAgentService extends Disposable implements IDeepSeekAgentService {
	declare readonly _serviceBrand: undefined;

	private readonly _onSessionUpdate = this._register(new Emitter<DeepSeekSessionUpdate>());
	readonly onSessionUpdate = this._onSessionUpdate.event;

	private readonly sessions = new Map<string, IDeepSeekSession>();
	private sequence = 0;

	async listSessions(): Promise<IDeepSeekSession[]> {
		return [...this.sessions.values()];
	}

	async createSession(modelId?: string): Promise<IDeepSeekSession> {
		const session: IDeepSeekSession = {
			id: `local-${++this.sequence}`,
			title: `会话 ${this.sequence}`,
			modelId: modelId ?? 'deepseek-chat',
			createdAt: Date.now(),
		};
		this.sessions.set(session.id, session);
		// TODO(M2): 改为 ACP session/new 返回的真实会话 id
		return session;
	}

	async sendPrompt(sessionId: string, _text: string, _token?: CancellationToken): Promise<void> {
		// TODO(M2): 转发 ACP session/prompt；流式更新从通道回流后在此 fire
		this._onSessionUpdate.fire({ kind: 'sessionIdle', sessionId, reason: 'completed' });
	}

	async answerApproval(_answer: IDeepSeekApprovalAnswer): Promise<void> {
		// TODO(M2): 转发到 Agent Host 的权限应答
	}

	async cancel(sessionId: string): Promise<void> {
		// TODO(M2): 转发 ACP session/cancel
		this._onSessionUpdate.fire({ kind: 'sessionIdle', sessionId, reason: 'cancelled' });
	}
}
