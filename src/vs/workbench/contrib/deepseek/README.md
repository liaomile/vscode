# contrib/deepseek — M1 原生骨架接线说明

文件（均为新增，不改官方既有文件）：

- `common/deepseekTypes.ts` — 与 DSH 的 ACP 语义对齐的会话/更新事件类型
- `browser/deepseekChatView.ts` — 原生聊天视图（ViewPane，DOM 渲染，无 webview）
- `browser/deepseek.contribution.ts` — 模块注册入口：Agent 服务、视图容器、视图、命令、配置
- `../../services/deepseek/common/deepseekAgentService.ts` — `IDeepSeekAgentService` 公共服务接口
- `../../services/deepseek/browser/deepseekAgentService.ts` — 服务实现骨架（M2 接 ACP 通道）

## 唯一一处官方文件改动（本地应用）

在 `src/vs/workbench/workbench.common.main.ts` 的 contrib import 区加一行：

```ts
import 'vs/workbench/contrib/deepseek/browser/deepseek.contribution';
```

此改动已登记在 zovaxai.com 仓库 `docs/PATCHES.md` 第 1 条；合并官方新版本时按表核对。

## 构建与验证（本地）

1. 把本目录与 `services/deepseek` 目录放进 fork 的对应路径（推送到 fork 时已按原路径落位）。
2. 应用上面那一行 import。
3. 按 VS Code 官方流程构建运行（`npm run watch` + 启动开发版），确认：
   - 辅助侧边栏出现 DeepSeek 入口；
   - 聊天视图能打开，输入框可输入并发送（M1 阶段会话为本地骨架，发送后立即收到 idle 事件）；
   - 命令面板可见 `deepseek.openChat` / `deepseek.newSession`。

> 说明：骨架代码按 VS Code 当前主干的 contrib 规范编写，但整仓编译只能在本地/fork 的 CI 验证；
> 首次构建若有个别 API 签名不符，按报错逐个对齐即可（视图与服务注册模式与官方 contrib/chat 同源）。
