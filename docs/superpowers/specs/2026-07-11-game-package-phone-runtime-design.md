# 游戏包手机运行时设计

## 目标

让 Joyly Games 平台在游戏开始后只负责读取房间的已选游戏 ID 并加载游戏包入口；平台不得直接导入、判断或渲染某个具体游戏的手机 UI、阶段或规则。

同时移除命运狼人当前的“公开记录”大屏和手机 UI。

## 边界

### 平台

平台持有房间、玩家身份、SSE 和游戏 ID。新增 `GamePhoneRuntime` 作为唯一的手机游戏装载点：接收 `room`、`code`、`playerId`、`embedded`，按游戏 ID 懒加载一个游戏包适配器，并在加载失败时显示包加载错误。

`InRoomPage` 与 `HostPhoneLobbyView` 只渲染 `GamePhoneRuntime`，不导入 Cosmic Trivia 或命运狼人组件，也不分支具体游戏 ID。

### 游戏包

每个包导出自己的手机适配器，定义游戏组件如何接收平台上下文：

```ts
export interface GamePhoneEntryProps {
  room: Room
  code: string
  playerId: string | null
  embedded?: boolean
}
```

Cosmic Trivia 适配器继续向其现有手机组件传入房间与嵌入模式。命运狼人适配器向命运狼人手机组件传入可选 `code` 和 `playerId`，使其既能由游戏运行时装载，也能继续由直接游戏 URL 装载。

平台中的包注册表只保存 `gameId -> dynamic import adapter`，不导入游戏页面或包含游戏规则。

## 用户路径

1. 玩家通过平台加入房间，平台保存玩家 ID。
2. 房间状态切换为 `playing`。
3. `/play/:code` 和房主手机的“玩家”标签都渲染 `GamePhoneRuntime`。
4. 运行时按选中 ID 懒加载包适配器。
5. 命运狼人包请求该玩家私密状态，角色分配阶段显示角色牌和“我已查看我的角色”；不再显示通用的 “Fate Werewolf is live”。

## 公开记录

移除 `PublicGameLedger`、手机 `PublicHistory` 及其可见标题。服务端公开历史投影暂时保留，供未来战报、回放或新的包内 UI 使用；它不再占用当前大屏或手机画面。

## 测试

- `InRoomPage` 针对命运狼人只装载运行时，不渲染通用兜底文案。
- 包注册表对 Cosmic Trivia 和命运狼人均能解析相应适配器。
- 命运狼人适配器在 `role-assignment` 私密状态下显示角色确认操作。
- 大屏和手机不存在“公开记录”可见 UI。
