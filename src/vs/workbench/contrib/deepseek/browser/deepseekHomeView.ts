/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zovax AI. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE in the project root.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from 'vs/base/browser/dom';
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
import { ICheckInStatus, IDeepSeekAccountService } from 'vs/workbench/services/deepseek/common/deepseekAccountService';

/**
 * 账户主页视图：DeepSeek 视图容器的第一个视图。
 * 未登录态：品牌区 + 登录按钮（点击经账户服务发起登录）。
 * 已登录态：账号信息 + 积分余额 + 每日签到卡（本月日历点阵、连续天数、签到按钮）。
 * 渲染为原生 DOM，跟随 workbench 主题；状态全部来自 IDeepSeekAccountService。
 */
export class DeepSeekHomeView extends ViewPane {
	static readonly ID = 'deepseek.homeView';

	private body: HTMLElement | undefined;

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
		@IDeepSeekAccountService private readonly accountService: IDeepSeekAccountService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this.body = append(container, $('div.deepseek-home'));
		this._register(this.accountService.onDidChangeAccount(() => void this.refresh()));
		void this.refresh();
	}

	private async refresh(): Promise<void> {
		if (!this.body) {
			return;
		}
		this.body.textContent = '';
		const account = this.accountService.account;
		if (!account) {
			this.renderSignedOut(this.body);
			return;
		}
		const status = await this.accountService.getCheckInStatus();
		this.renderSignedIn(this.body, account.name, status);
	}

	private renderSignedOut(root: HTMLElement): void {
		append(root, $('div.deepseek-home__brand')).textContent = '✦ DeepSeek';
		append(root, $('p.deepseek-home__hint')).textContent = '登录后可同步会话、参与每日签到领取积分，积分可兑换 AI 调用额度。';
		const button = append(root, $('button.deepseek-home__primary')) as HTMLButtonElement;
		button.textContent = '登录 / 注册';
		const onClick = () => { void this.accountService.signIn().then(() => this.refresh()); };
		button.addEventListener('click', onClick);
		this._register({ dispose: () => button.removeEventListener('click', onClick) });
	}

	private renderSignedIn(root: HTMLElement, name: string, status: ICheckInStatus | undefined): void {
		const header = append(root, $('div.deepseek-home__account'));
		append(header, $('span.deepseek-home__avatar')).textContent = name.slice(0, 1).toUpperCase();
		append(header, $('span.deepseek-home__name')).textContent = name;
		const signOut = append(header, $('button.deepseek-home__ghost')) as HTMLButtonElement;
		signOut.textContent = '退出';
		const onSignOut = () => { void this.accountService.signOut().then(() => this.refresh()); };
		signOut.addEventListener('click', onSignOut);
		this._register({ dispose: () => signOut.removeEventListener('click', onSignOut) });

		if (!status) {
			return;
		}
		append(root, $('div.deepseek-home__credits')).textContent = `积分余额：${status.credits}`;

		const card = append(root, $('div.deepseek-home__checkin'));
		append(card, $('div.deepseek-home__checkin-title')).textContent =
			`每日签到 · 已连续 ${status.streakDays} 天`;

		// 本月日历点阵：已签为实心，今日高亮
		const now = new Date();
		const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
		const calendar = append(card, $('div.deepseek-home__calendar'));
		for (let day = 1; day <= daysInMonth; day++) {
			const dot = append(calendar, $('span.deepseek-home__dot'));
			if (status.monthSignedDays.includes(day)) {
				dot.classList.add('signed');
				dot.textContent = '●';
			} else if (day === now.getDate()) {
				dot.classList.add('today');
				dot.textContent = '◐';
			} else {
				dot.textContent = '○';
			}
			dot.title = `${day} 日`;
		}

		const button = append(card, $('button.deepseek-home__primary')) as HTMLButtonElement;
		if (status.checkedInToday) {
			button.textContent = '今日已签到';
			button.disabled = true;
		} else {
			button.textContent = `签到领取 ${status.todayReward} 积分`;
			const onCheckIn = () => { void this.accountService.checkIn().then(() => this.refresh()); };
			button.addEventListener('click', onCheckIn);
			this._register({ dispose: () => button.removeEventListener('click', onCheckIn) });
		}
	}
}
