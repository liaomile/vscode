/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zovax AI. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE in the project root.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import {
	AuthenticationProvider,
	AuthenticationSession,
	IAuthenticationService,
} from 'vs/workbench/services/authentication/common/authentication';
import { IDeepSeekAccountService } from 'vs/workbench/services/deepseek/common/deepseekAccountService';

/**
 * 把 Zovax 账号接入 VS Code 原生认证体系：注册一个 AuthenticationProvider，
 * 这样编辑器左下角的「账户」菜单、设置同步等原生入口都认我们的登录，
 * 而不是自造一个孤岛登录页——这是深改路线与普通插件的区别。
 *
 * 骨架阶段：会话由 IDeepSeekAccountService 的登录结果投影而来；
 * 生产实现中 createSession 应完成真实授权（OAuth 浏览器跳转或验证码），
 * 并把后端令牌交给账户服务存入 SecretStorage，契约见 docs/ACCOUNT.md。
 */
class ZovaxAuthenticationProvider extends Disposable implements AuthenticationProvider {
	readonly id = 'zovaxai';
	readonly label = 'Zovax 账号';
	readonly supportsMultipleAccounts = false;

	private readonly _onDidChangeSessions = this._register(new Emitter<{
		added?: AuthenticationSession[];
		removed?: AuthenticationSession[];
		changed?: AuthenticationSession[];
	}>());
	readonly onDidChangeSessions = this._onDidChangeSessions.event;

	constructor(private readonly accountService: IDeepSeekAccountService) {
		super();
		this._register(this.accountService.onDidChangeAccount((account) => {
			this._onDidChangeSessions.fire({
				changed: account ? [this.toSession()] : [],
				removed: account ? [] : undefined,
			});
		}));
	}

	async getSessions(): Promise<AuthenticationSession[]> {
		return this.accountService.account ? [this.toSession()] : [];
	}

	async createSession(): Promise<AuthenticationSession> {
		await this.accountService.signIn();
		return this.toSession();
	}

	async removeSession(): Promise<void> {
		await this.accountService.signOut();
	}

	private toSession(): AuthenticationSession {
		const account = this.accountService.account;
		return {
			id: account?.id ?? '',
			accessToken: '', // 令牌只存 SecretStorage，不经会话对象外泄
			account: { id: account?.id ?? '', label: account?.name ?? '' },
			scopes: [],
		};
	}
}

class DeepSeekAuthContribution extends Disposable implements IWorkbenchContribution {
	constructor(
		@IAuthenticationService authenticationService: IAuthenticationService,
		@IDeepSeekAccountService accountService: IDeepSeekAccountService,
	) {
		super();
		const provider = new ZovaxAuthenticationProvider(accountService);
		this._register(provider);
		this._register(authenticationService.registerAuthenticationProvider(provider.id, provider));
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.WorkbenchContributions)
	.registerWorkbenchContribution(DeepSeekAuthContribution, LifecyclePhase.Eventually);
