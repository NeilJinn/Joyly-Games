# 命运狼人架构

## 当前范围

首发核心模式支持 6–10 名玩家，使用村民、狼人、神谕者、命运编织者、月光守护者和猎人。丘比特、焚焰者、梦境使者及其对应胜利条件是已预留的扩展，不进入首发牌组。

平台仍负责房间、主持人和手机端传输；游戏规则由 `games/werewolf/server/` 独立管理，服务端状态是唯一结算依据。

## 运行时与代码边界

- `games/werewolf/server/game.js`
  - 创建 6–10 人牌组、推进昼夜阶段、处理玩家行动并生成公开/私密状态。
- `games/werewolf/server/roles/registry.js`
  - 注册核心及未来扩展角色；定义阵营、夜晚步骤和可选胜利钩子。
- `games/werewolf/server/resolvers/night.js`
  - 纯夜晚结算：狼人行动、守护、命运编织者和猎人陪葬资格。
- `games/werewolf/server/resolvers/victory.js`
  - 纯胜利判定；第三阵营钩子优先于狼人和月神阵营。
- `games/werewolf/server/fate/cards.js`
  - 大小阿尔克那占位牌定义和根据命运议会倾向加权抽取的逻辑。
- `games/werewolf/client/BigScreenPage.tsx`
  - 大屏阶段引导、公开命运牌与安全历史展示。
- `games/werewolf/client/PhonePage.tsx`
  - 当前玩家唯一可执行动作、个人笔记、怀疑/信任名单及公开历史。

## 核心流程

`role-assignment` 确认角色后，进入夜晚角色队列。夜晚结算完成后，死亡玩家进入 `fate-council` 投四种命运倾向。所有票到齐或主持人关闭议会后，系统才抽取命运牌并依序展示：

`fate-card-reveal → fate-blessing → night-results → discussion-r1 → discussion-r2 → voting → execution → victory-check`

平票会额外进入 `pk-discussion → pk-voting`。猎人需要陪葬时，会在夜晚或放逐结算后进入 `hunter-revenge`。公开状态不包含角色、阵营、私密行动或个人命运议会选票；私密状态只在当前阶段向有资格的玩家提供动作。

## 命运牌扩展契约

每张牌均是一个稳定对象，至少包含：

- `id`
- `arcanaType`：`minor` 或 `major`
- `tendency`：`omen`、`shelter`、`chaos` 或 `dark`
- `title`、`text`
- `effectKey`
- 大阿尔克那的 `trigger`

当前所有 `effectKey` 都是 `placeholder`：牌会被抽取、公开、写入安全历史并标为已处理，但不会改变玩家、投票或胜利结果。实现具体卡牌时，应先为新的 `effectKey` 增加类型、解析器和测试；不得把效果直接塞进阶段推进逻辑。大阿尔克那由首狼死亡、连续两晚无人死亡或终盘等触发器进入候选池。

## 角色扩展契约

新增角色通过 `registerRole` 注册。模块可声明：

- `id`、`team` 和公开角色定义；
- 有序 `nightSteps`；
- 可选 `victoryCheck`。

随后在 `game.js` 添加该角色的私密行动校验与夜晚数据，在独立 resolver 中完成结算，并为可见性和胜利条件添加测试。这样丘比特、焚焰者和梦境使者不需要改写核心昼夜状态机。

## 验证

`games/werewolf/server/__tests__/core-game.integration.test.ts` 覆盖 6、8、10 人牌组、公开/私密可见性以及从确认角色到完整结束的一局流程。其他服务器测试覆盖夜晚结算、胜利判定、命运牌和玩家操作；`npm run test:ui` 执行所有这些测试。
