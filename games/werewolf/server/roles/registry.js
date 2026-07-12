/**
 * Role modules are declarative so future roles can add their own steps and
 * victory hooks without changing the game director.
 */
const coreRoles = [
  { id: 'werewolf', name: '狼人', team: 'wolf', cardTitle: '狼人', summary: '夜间选择击杀目标', accent: '#c0392b', nightSteps: [{ id: 'wolf-action', order: 20 }] },
  { id: 'guardian', name: '月光守护者', team: 'moon', cardTitle: '月光守护者', summary: '每夜守护一位玩家，不可连续守护', accent: '#2980b9', nightSteps: [{ id: 'guardian-action', order: 10 }] },
  { id: 'oracle', name: '神谕者', team: 'moon', cardTitle: '神谕者', summary: '每夜收到一条阵营神谕提示', accent: '#8e44ad', nightSteps: [{ id: 'oracle-action', order: 40 }] },
  { id: 'fateweaver', name: '命运编织者', team: 'moon', cardTitle: '命运编织者', summary: '可用卡牌干预命运', accent: '#16a085', nightSteps: [{ id: 'fate-weaver-action', order: 30 }] },
  { id: 'hunter', name: '猎人', team: 'moon', cardTitle: '猎人', summary: '死亡时可带走一名玩家殉葬', accent: '#d35400', nightSteps: [] },
  { id: 'villager', name: '村民', team: 'moon', cardTitle: '村民', summary: '白天投票识破狼人', accent: '#7f8c8d', nightSteps: [] },
]

export const coreRoleIds = Object.freeze(coreRoles.map(role => role.id))

const modules = new Map(coreRoles.map(role => [role.id, role]))

export function registerRole(module) {
  if (!module?.id) throw new Error('Role module must have an id')
  modules.set(module.id, { nightSteps: [], victoryCheck: null, ...module })
}

export function getRole(roleId) {
  return modules.get(roleId) ?? modules.get('villager')
}

export function getRoleDefinitions() {
  return Object.fromEntries([...modules.entries()])
}

export function nightStepsForRoles(roleIds, { firstNight = false } = {}) {
  return [...new Set(roleIds)]
    .flatMap(roleId => (getRole(roleId).nightSteps ?? []).filter(step => !step.firstNightOnly || firstNight))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map(step => step.id)
}

export function thirdPartyVictoryHooks() {
  return [...modules.values()]
    .filter(role => role.team === 'third' && typeof role.victoryCheck === 'function')
    .map(role => Object.assign(role.victoryCheck, { roleId: role.id }))
}
