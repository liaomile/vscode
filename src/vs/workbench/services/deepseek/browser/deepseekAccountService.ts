/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zovax AI. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE in the project root.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { ICheckInStatus, IDeepSeekAccount, IDeepSeekAccountService } from 'vs/workbench/services/deepseek/common/deepseekAccountService';

const CHECKIN_STORAGE_KEY = 'deepseek.checkin.localState';

interface ILocalCheckInState {
	monthKey: string; // yyyy-mm
	signedDays: number[];
	streakDays: number;
	lastSignedDay: string; // yyyy-mm-dd
	credits: number;
}

/**
 * 账户服务实现（骨架）：
 * - 登录：当前为联调用的本地演示会话；生产实现走 deepseekAuthProvider 的授权结果
 *   并向后端换取会话令牌（存 SecretStorage），见 docs/ACCOUNT.md 的接口契约。
 * - 签到：当前用本地存储模拟状态机（幂等、连续天数、本月日历），便于界面先行联调；
 *   上线时 getCheckInStatus/checkIn 改为调后端接口，本地状态只作缓存展示。
 */
export class DeepSeekAccountService extends Disposable implements IDeepSeekAccountService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeAccount = this._register(new Emitter<IDeepSeekAccount | undefined>());
	readonly onDidChangeAccount = this._onDidChangeAccount.event;

	private _account: IDeepSeekAccount | undefined;
	get account(): IDeepSeekAccount | undefined {
		return this._account;
	}

	constructor(
		@IStorageService private readonly storageService: IStorageService,
	) {
		super();
	}

	async signIn(): Promise<IDeepSeekAccount> {
		// TODO(生产): 经认证提供者完成 OAuth/验证码授权 -> 后端换令牌 -> 存 SecretStorage
		this._account = { id: 'demo-user', name: '演示账号' };
		this._onDidChangeAccount.fire(this._account);
		return this._account;
	}

	async signOut(): Promise<void> {
		this._account = undefined;
		this._onDidChangeAccount.fire(undefined);
	}

	async getCheckInStatus(): Promise<ICheckInStatus | undefined> {
		if (!this._account) {
			return undefined;
		}
		const state = this.loadState();
		const today = new Date();
		return {
			checkedInToday: state.lastSignedDay === toDayKey(today),
			streakDays: state.streakDays,
			monthSignedDays: state.signedDays,
			credits: state.credits,
			todayReward: rewardForStreak(state.streakDays + 1),
		};
	}

	async checkIn(): Promise<ICheckInStatus | undefined> {
		if (!this._account) {
			return undefined;
		}
		const state = this.loadState();
		const now = new Date();
		const todayKey = toDayKey(now);
		if (state.lastSignedDay !== todayKey) {
			const yesterday = new Date(now);
			yesterday.setDate(now.getDate() - 1);
			state.streakDays = state.lastSignedDay === toDayKey(yesterday) ? state.streakDays + 1 : 1;
			state.credits += rewardForStreak(state.streakDays);
			if (!state.signedDays.includes(now.getDate())) {
				state.signedDays.push(now.getDate());
			}
			state.lastSignedDay = todayKey;
			this.saveState(state);
		}
		return this.getCheckInStatus();
	}

	private loadState(): ILocalCheckInState {
		const monthKey = toMonthKey(new Date());
		const raw = this.storageService.get(CHECKIN_STORAGE_KEY, StorageScope.PROFILE);
		if (raw) {
			try {
				const parsed = JSON.parse(raw) as ILocalCheckInState;
				if (parsed.monthKey === monthKey) {
					return parsed;
				}
			} catch {
				/* 状态损坏则重建 */
			}
		}
		return { monthKey, signedDays: [], streakDays: 0, lastSignedDay: '', credits: 0 };
	}

	private saveState(state: ILocalCheckInState): void {
		this.storageService.store(CHECKIN_STORAGE_KEY, JSON.stringify(state), StorageScope.PROFILE, StorageTarget.USER);
	}
}

/** 签到奖励：连续签到阶梯（第 1 天 10 分，之后递增，第 7 天起 30 分封顶） */
function rewardForStreak(streakDay: number): number {
	return Math.min(10 + (streakDay - 1) * 5, 30);
}

function toDayKey(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toMonthKey(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function pad(n: number): string {
	return n < 10 ? `0${n}` : `${n}`;
}
