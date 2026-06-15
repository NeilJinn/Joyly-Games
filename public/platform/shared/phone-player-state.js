export function reconcilePhonePlayerState({
  room,
  playerId,
  previousPlayer,
  phonePlayerEditing
}) {
  const nextPlayer = room?.players?.find?.(item => item.id === playerId) || null;
  const shouldKeepEditing = Boolean(
    phonePlayerEditing &&
    nextPlayer &&
    room?.status === "waiting" &&
    nextPlayer.ready !== true
  );

  return {
    player: nextPlayer || previousPlayer || null,
    phonePlayerEditing: shouldKeepEditing
  };
}
