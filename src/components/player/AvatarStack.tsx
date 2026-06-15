import type { AvatarSelection } from "../../types/avatar";
import { paletteById } from "../../types/avatar";

interface AvatarStackProps {
  avatar: AvatarSelection | null;
  size?: "small" | "normal" | "large" | "hero";
  ringColor?: string;
  glowColor?: string;
  greyscale?: boolean;
  className?: string;
}

export default function AvatarStack({
  avatar,
  size = "normal",
  ringColor,
  glowColor,
  greyscale,
  className,
}: AvatarStackProps) {
  const palette = paletteById(avatar?.paletteId ?? "teal");

  const style = {
    "--avatar-fill": palette.fill,
    "--avatar-ring": ringColor ?? palette.ring,
    "--avatar-glow": glowColor ? `${glowColor}66` : "transparent",
    ...(greyscale ? { filter: "grayscale(1) drop-shadow(0 10px 18px rgba(0,0,0,.22))" } : {}),
  } as React.CSSProperties;

  const sizeClass = size === "normal" ? "" : size;

  return (
    <div
      className={["avatar-stack", sizeClass, className].filter(Boolean).join(" ")}
      style={style}
    >
      <div className="avatar-core">
        <div className="avatar-core-fill" />
        {avatar?.characterId && (
          <img
            className="avatar-layer avatar-character"
            src={`/assets/avatars/characters/${avatar.characterId}.png`}
            alt=""
            draggable={false}
          />
        )}
      </div>
      {avatar?.hatId && (
        <img
          className="avatar-layer avatar-hat"
          src={`/assets/avatars/hats/${avatar.hatId}.png`}
          alt=""
          draggable={false}
        />
      )}
      {avatar?.decorationId && (
        <img
          className="avatar-layer avatar-decoration"
          src={`/assets/avatars/decorations/${avatar.decorationId}.png`}
          alt=""
          draggable={false}
        />
      )}
      <div className="avatar-ring" />
    </div>
  );
}
