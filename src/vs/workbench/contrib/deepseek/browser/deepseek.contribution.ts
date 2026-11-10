/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zovax AI. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE in the project root.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from 'vs/base/common/codicons';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { registerSingleton, InstantiationType } from 'vs/platform/instantiation/common/extensions';
import { Registry } from 'vs/platform/registry/common/platform';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { ViewPaneContainer } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { IViewContainersRegistry, IViewsRegistry, ViewContainer, ViewContainerLocation, Extensions as ViewExtensions } from 'vs/workbench/common/views';
import { DeepSeekChatView } from 'vs/workbench/contrib/deepseek/browser/deepseekChatView';
import { DeepSeekHomeView } from 'vs/workbench/contrib/deepseek/browser/deepseekHomeView';
import { IDeepSeekAgentService } from 'vs/workbench/services/deepseek/common/deepseekAgentService';
import { DeepSeekAgentService } from 'vs/workbench/services/deepseek/browser/deepseekAgentService';
import { IDeepSeekAccountService } from 'vs/workbench/services/deepseek/common/deepseekAccountService';
import { DeepSeekAccountService } from 'vs/workbench/services/deepseek/browser/deepseekAccountService';
import 'vs/workbench/contrib/deepseek/browser/deepseekAuthProvider';

/**
 * DeepSeek 融合模块的注册入口（M1）。
 * 本文件是新增文件；让它生效只需要在 workbench.common.main.ts 加一行 import，
 * 该官方文件改动登记在 zovaxai.com 仓库的 docs/PATCHES.md。
 */

// 1) 服务：编辑器级公共能力，Delayed 注册（首次使用时实例化）
registerSingleton(IDeepSeekAgentService, DeepSeekAgentService, InstantiationType.Delayed);
registerSingleton(IDeepSeekAccountService, DeepSeekAccountService, InstantiationType.Delayed);

// 2) 视图容器：辅助侧边栏一级入口（标准 ViewPaneContainer 注册法，与官方各 contrib 一致）
const viewContainer: ViewContainer = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry).registerViewContainer(
	{
		id: 'deepseek',
		title: { value: 'DeepSeek', original: 'DeepSeek' },
		icon: Codicon.sparkle,
		ctorDescriptor: new SyncDescriptor(ViewPaneContainer, ['deepseek', 'deepseek.state']),
		storageId: 'deepseek.state',
		order: 90,
	},
	ViewContainerLocation.AuxiliaryBar,
	{ isDefault: true },
);

// 3) 视图：账户主页（登录/签到）在前，对话视图在后
Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews(
	[
		{
			id: DeepSeekHomeView.ID,
			name: { value: '账户', original: 'Account' },
			ctorDescriptor: new SyncDescriptor(DeepSeekHomeView),
			canToggleVisibility: false,
			canMoveView: true,
			containerIcon: Codicon.account,
		},
		{
			id: DeepSeekChatView.ID,
			name: { value: 'DeepSeek 对话', original: 'DeepSeek Chat' },
			ctorDescriptor: new SyncDescriptor(DeepSeekChatView),
			canToggleVisibility: false,
			canMoveView: true,
			containerIcon: Codicon.sparkle,
		},
	],
	viewContainer,
);

// 4) 命令
CommandsRegistry.registerCommand('deepseek.openChat', (accessor) => {
	const views = accessor.get(IViewsRegistry);
	void views; // TODO(M1): 打开辅助侧边栏并聚焦 deepseek.chatView（走 IViewsService.openView）
});
CommandsRegistry.registerCommand('deepseek.newSession', (accessor) => {
	const agent = accessor.get(IDeepSeekAgentService);
	return agent.createSession();
});

// 5) 配置项（API Key 不在此处，走 SecretStorage；这里只放非敏感设置）
Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'deepseek',
	title: 'DeepSeek',
	properties: {
		'deepseek.model': {
			type: 'string',
			default: 'deepseek-chat',
			enum: ['deepseek-chat', 'deepseek-reasoner'],
			description: '默认使用的 DeepSeek 模型（执行用 chat，规划用 reasoner）。',
		},
		'deepseek.plannerModel': {
			type: 'string',
			default: 'deepseek-reasoner',
			description: '规划阶段使用的模型。',
		},
		'deepseek.acpCommand': {
			type: 'string',
			default: '',
			description: '拉起 DSH ACP 服务端的完整命令，如 "pnpm dsh --profile acp"（需在本机 DSH 仓库目录可执行）。留空则不自动拉起。',
		},
	},
});
