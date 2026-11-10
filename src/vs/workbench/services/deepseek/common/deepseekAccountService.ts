/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zovax AI. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE in the project root.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IDeepSeekAccountService = createDecorator<IDeepSeekAccountService>('deepseekAccountService');

export interface IDeepSeekAccount {
	readonly id: string;
	readonly name: string;
	readonly avatarUrl?: string;
}

/** 签到状态：以后端为准（防刷、防改本地时间），客户端只展示与触发 */
export interface ICheckInStatus {
	/** 今日是否已签到 */
	readonly checkedInToday: boolean;
	/** 连续签到天数 */
	readonly streakDays: number;
	/** 本月已签到的日期（1-31） */
	readonly monthSignedDays: number[];
	/** 当前积分余额（积分可兑换 AI 调用额度） */
	readonly credits: number;
	/** 今日签到可得积分 */
	readonly todayReward: number;
}

/**
 * 账户服务：登录态与每日签到的统一入口（账户主页视图、Agent 服务的额度校验都经此）。
 * 登录走 VS Code 原生认证体系（见 contrib 的 deepseekAuthProvider），会话令牌存 SecretStorage；
 * 签到与积分是服务端状态，接口契约见 zovaxai.com 仓库 docs/ACCOUNT.md。
 */
export interface IDeepSeekAccountService {
	readonly _serviceBrand: undefined;

	/** 登录态变化（登录/退出） */
	readonly onDidChangeAccount: Event<IDeepSeekAccount | undefined>;

	/** 当前账号，未登录为 undefined */
	readonly account: IDeepSeekAccount | undefined;

	/** 发起登录（经认证提供者完成授权后建立会话） */
	signIn(): Promise<IDeepSeekAccount>;

	/** 退出登录 */
	signOut(): Promise<void>;

	/** 读取签到状态（未登录时抛错/返回 undefined 由实现约定为返回 undefined） */
	getCheckInStatus(): Promise<ICheckInStatus | undefined>;

	/** 执行今日签到，返回签到后的最新状态；重复签到返回当前状态不重复发奖 */
	checkIn(): Promise<ICheckInStatus | undefined>;
}
