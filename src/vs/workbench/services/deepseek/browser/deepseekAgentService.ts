/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zovax AI. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE in the project root.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { Disposable } from 'vs/base/common/lifecycle';
import { Emitter } from 'vs/base/common/event';
import { IDeepSeekAgentService } from 'vs/workbench/services/deepseek/common/deepseekAgentService';
import { IDeepSeekApprovalAnswer, IDeepSeekSession, DeepSeekSessionUpdate } from 'vs/workbench/contrib/deepseek/common/deepseekTypes';
import { AcpClient } from 'vs/workbench/contrib/deepseek/common/deepseekAcp';

/**
 * IDeepSeekAgentService 的 workbench 侧实现（M1 骨架）。
 *
 * 待接（M2）：经 IPC 通道连接 Agent Host 进程，Agent Host 以 ACP 驱动 DSH：
 *   createSession  -> ACP session/new
 *   sendPrompt     -> ACP session/prompt（更新经 session/update 通知回流为 DeepSeekSessionUpdate）
 *   answerApproval -> ACP session request_permission 的应答
 *   cancel         -> ACP session/cancel
 * ACP 客户端（common/deepseekAcp.ts）已实现并经模拟服务端验证；宿主层注入后
 * 本实现即走真实会话，未注入时回落到本地骨架行为，保证视图层可先行联调渲染。
 */
export class DeepSeekAgentService extends Disposable implements IDeepSeekAgentService {
	declare readonly _serviceBrand: undefined;

	private readonly _onSessionUpdate = this._register(new Emitter<DeepSeekSessionUpdate>());
	readonly onSessionUpdate = this._onSessionUpdate.event;

	private readonly sessions = new Map<string, IDeepSeekSession>();
	private sequence = 0;

	/** ACP 接入点：由宿主层（Agent Host 通道就绪后）注入；未注入时走本地骨架行为 */
	private acpClient: AcpClient | undefined;
	private acpCwd = '';
	private readonly pendingApprovals = new Map<string, { resolve(approved: boolean): void }>();

	/**
	 * 注入 ACP 客户端（其 onUpdate 应转发到本服务的事件流，onPermissionRequest 应走
	 * requestPermissionFromUi）。通道的进程拉起（stdio 子进程）在宿主层完成，不属于本类。
	 */
	attachAcpClient(client: AcpClient, cwd: string): void {
		this.acpClient = client;
		this.acpCwd = cwd;
	}

	/** 供 ACP 客户端的 onUpdate 回调使用：把通道回流的更新转发到本服务的事件流 */
	handleAcpUpdate(update: DeepSeekSessionUpdate): void {
		this._onSessionUpdate.fire(update);
	}

	/** 供 ACP 客户端的权限回调使用：把审批请求推给界面，等 answerApproval 应答 */
	requestPermissionFromUi(sessionId: string, requestId: string, title: string): Promise<boolean> {
		this._onSessionUpdate.fire({ kind: 'approvalRequest', sessionId, requestId, title });
		return new Promise<boolean>((resolve) => {
			this.pendingApprovals.set(requestId, { resolve });
		});
	}

	async listSessions(): Promise<IDeepSeekSession[]> {
		return [...this.sessions.values()];
	}

	async createSession(modelId?: string): Promise<IDeepSeekSession> {
		if (this.acpClient) {
			const { sessionId } = await this.acpClient.newSession(this.acpCwd);
			const session: IDeepSeekSession = {
				id: sessionId,
				title: `会话 ${++this.sequence}`,
				modelId: modelId ?? 'deepseek-chat',
				createdAt: Date.now(),
			};
			this.sessions.set(session.id, session);
			return session;
		}
		const session: IDeepSeekSession = {
			id: `local-${++this.sequence}`,
			title: `会话 ${this.sequence}`,
			modelId: modelId ?? 'deepseek-chat',
			createdAt: Date.now(),
		};
		this.sessions.set(session.id, session);
		return session;
	}

	async sendPrompt(sessionId: string, text: string, token?: CancellationToken): Promise<void> {
		if (this.acpClient) {
			const disposable = token?.onCancellationRequested(() => this.acpClient?.cancel(sessionId));
			try {
				const { stopReason } = await this.acpClient.prompt(sessionId, text);
				this._onSessionUpdate.fire({
					kind: 'sessionIdle',
					sessionId,
					reason: stopReason === 'cancelled' ? 'cancelled' : 'completed',
				});
			} catch (error) {
				this._onSessionUpdate.fire({
					kind: 'sessionIdle',
					sessionId,
					reason: 'error',
					message: error instanceof Error ? error.message : String(error),
				});
			} finally {
				disposable?.dispose();
			}
			return;
		}
		this._onSessionUpdate.fire({ kind: 'sessionIdle', sessionId, reason: 'completed' });
	}

	async answerApproval(answer: IDeepSeekApprovalAnswer): Promise<void> {
		const pending = this.pendingApprovals.get(answer.requestId);
		if (pending) {
			this.pendingApprovals.delete(answer.requestId);
			pending.resolve(answer.approved);
		}
	}

	async cancel(sessionId: string): Promise<void> {
		if (this.acpClient) {
			this.acpClient.cancel(sessionId);
		}
		this._onSessionUpdate.fire({ kind: 'sessionIdle', sessionId, reason: 'cancelled' });
	}
}
