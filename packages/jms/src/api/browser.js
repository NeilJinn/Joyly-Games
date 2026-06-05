import {
  motionPackPlayer
} from "../packs/motion-pack-player.js";

export function installJMS(target = globalThis) {
  if (!target) return null;

  target.JMS = {
    ...(target.JMS || {}),
    playPack: motionPackPlayer.playPack.bind(motionPackPlayer),
    previewPack: motionPackPlayer.previewPack.bind(motionPackPlayer),
    stopPack: motionPackPlayer.stopPack.bind(motionPackPlayer),
    stopAllPacks: motionPackPlayer.stopAllPacks.bind(motionPackPlayer),
    playCue: motionPackPlayer.playCue.bind(motionPackPlayer),
    previewCue: motionPackPlayer.previewCue.bind(motionPackPlayer),
    stopCue: motionPackPlayer.stopCue.bind(motionPackPlayer),
    stopAllCues: motionPackPlayer.stopAllCues.bind(motionPackPlayer),
    registerMotionPack: motionPackPlayer.registerMotionPack.bind(motionPackPlayer),
    unregisterMotionPack: motionPackPlayer.unregisterMotionPack.bind(motionPackPlayer),
    getMotionPack: motionPackPlayer.getMotionPack.bind(motionPackPlayer),
    listMotionPacks: motionPackPlayer.listMotionPacks.bind(motionPackPlayer),
    validateMotionPack: motionPackPlayer.validateMotionPack.bind(motionPackPlayer),
    loadMotionPack: motionPackPlayer.loadMotionPack.bind(motionPackPlayer),
    exportMotionPack: motionPackPlayer.exportMotionPack.bind(motionPackPlayer),
    resolveMotionPackSlots: motionPackPlayer.resolveMotionPackSlots.bind(motionPackPlayer),
    applyThemeToMotionPack: motionPackPlayer.applyThemeToMotionPack.bind(motionPackPlayer),
    registerCue: motionPackPlayer.registerCue.bind(motionPackPlayer),
    unregisterCue: motionPackPlayer.unregisterCue.bind(motionPackPlayer),
    getCue: motionPackPlayer.getCue.bind(motionPackPlayer),
    listCues: motionPackPlayer.listCues.bind(motionPackPlayer),
    validateCue: motionPackPlayer.validateCue.bind(motionPackPlayer),
    loadCuePackage: motionPackPlayer.loadCuePackage.bind(motionPackPlayer),
    exportCuePackage: motionPackPlayer.exportCuePackage.bind(motionPackPlayer),
    registry: motionPackPlayer.registry
  };

  return target.JMS;
}
