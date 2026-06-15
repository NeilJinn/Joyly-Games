import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PhoneLayout from "../../components/player/PhoneLayout";
import AvatarStack from "../../components/player/AvatarStack";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import { usePlayerStore } from "../../stores/playerStore";
import { useRoomStore } from "../../stores/roomStore";
import {
  loadPlayerIdentity,
  makePlayerId,
  savePlayerIdentity,
} from "../../types/player";
import {
  PALETTES,
  defaultAvatar,
  type AvatarCatalog,
  type AvatarCatalogItem,
  type AvatarSelection,
} from "../../types/avatar";
import type { Room } from "../../types/room";

type Tab = "characterId" | "hatId" | "decorationId";

const TAB_LABELS: Record<Tab, string> = {
  characterId: "Character",
  hatId: "Hat",
  decorationId: "Decoration",
};

const ART_CLASS: Record<Tab, string> = {
  characterId: "cat-character",
  hatId: "cat-hat",
  decorationId: "cat-decoration",
};

export default function AvatarPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const setPlayer = usePlayerStore((s) => s.setPlayer);
  const setRoom = useRoomStore((s) => s.setRoom);

  const [room, setLocalRoom] = useState<Room | null>(null);
  const [roomError, setRoomError] = useState("");
  const [nickname, setNickname] = useState("");
  const [catalog, setCatalog] = useState<AvatarCatalog | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("characterId");
  const [avatar, setAvatar] = useState<AvatarSelection>({
    characterId: null,
    hatId: null,
    decorationId: null,
    paletteId: "teal",
  });
  const [catalogError, setCatalogError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    fetch("/api/avatar-catalog")
      .then((r) => r.json())
      .then((data: AvatarCatalog) => {
        setCatalog(data);
        const savedIdentity = loadPlayerIdentity();
        const savedAv = savedIdentity?.avatar;
        const charValid = savedAv?.characterId &&
          data.characters.some((c) => c.id === savedAv.characterId);
        if (charValid && savedAv) {
          const hatValid = !savedAv.hatId || data.hats.some((h) => h.id === savedAv.hatId);
          const decValid = !savedAv.decorationId || data.decorations.some((d) => d.id === savedAv.decorationId);
          setAvatar({
            characterId: savedAv.characterId,
            hatId: hatValid ? savedAv.hatId : null,
            decorationId: decValid ? savedAv.decorationId : null,
            paletteId: savedAv.paletteId,
          });
        } else if (data.characters[0]) {
          setAvatar(defaultAvatar(data.characters[0].id));
        }
      })
      .catch(() => { setCatalogError(true); });
  }, []);

  useEffect(() => {
    if (!code) return;
    (async () => {
      try {
        const res = await fetch(`/api/rooms/${code}`);
        const data = (await res.json()) as { room: Room };
        if (!data.room) { setRoomError("Room not found."); return; }
        if (data.room.status === "closed") { setRoomError("This room is closed."); return; }
        setLocalRoom(data.room);
        setRoom(data.room);

        const identity = loadPlayerIdentity();
        if (identity?.playerId && identity.nickname) {
          const savedAvatar = identity.avatar;
          if (savedAvatar?.characterId) {
            const joinRes = await fetch(`/api/rooms/${code}/join`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                playerId: identity.playerId,
                nickname: identity.nickname,
                avatar: savedAvatar,
              }),
            });
            if (joinRes.ok) {
              const joinData = (await joinRes.json()) as { player: { id: string; nickname: string }; room: Room };
              setRoom(joinData.room);
              setPlayer({ playerId: joinData.player.id, nickname: joinData.player.nickname, avatar: savedAvatar });
              navigate(`/waiting/${code}`, { replace: true });
              return;
            }
          }
        }
        if (identity?.nickname) setNickname(identity.nickname);
        if (identity?.avatar) setAvatar(identity.avatar);
      } catch {
        setRoomError("Could not load room. Check your connection.");
      }
    })();
  }, [code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code || !room) return;
    const trimmed = nickname.trim();
    if (!trimmed) { setJoinError("Enter a nickname"); return; }
    if (!avatar.characterId) { setJoinError("Pick a character"); return; }
    setSubmitting(true);
    setJoinError("");
    try {
      const playerId = loadPlayerIdentity()?.playerId ?? makePlayerId();
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, nickname: trimmed, avatar }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to join");
      }
      const data = (await res.json()) as { player: { id: string; nickname: string }; room: Room };
      savePlayerIdentity({ playerId: data.player.id, nickname: data.player.nickname, avatar });
      setPlayer({ playerId: data.player.id, nickname: data.player.nickname, avatar });
      setRoom(data.room);
      navigate(`/waiting/${code}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setSubmitting(false);
    }
  }

  function selectItem(tab: Tab, id: string | null) {
    setAvatar((prev) => ({ ...prev, [tab]: id }));
  }

  function renderGrid(tab: Tab, items: AvatarCatalogItem[]) {
    const isOptional = tab !== "characterId";
    const currentVal = avatar[tab];
    return (
      <div className="avatar-choice-group">
        <div className="avatar-choice-head">
          <h2>{TAB_LABELS[tab]}</h2>
          {isOptional && <span>Optional</span>}
        </div>
        <div className="avatar-choice-grid">
          {isOptional && (
            <button
              type="button"
              className={["avatar-choice-card none-card", currentVal === null ? "active" : ""].join(" ")}
              onClick={() => selectItem(tab, null)}
              aria-label="None"
            />
          )}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={["avatar-choice-card", currentVal === item.id ? "active" : ""].join(" ")}
              onClick={() => selectItem(tab, item.id)}
              aria-label={item.nameEn}
            >
              <div className={`avatar-choice-art ${ART_CLASS[tab]}`}>
                <img src={item.src} alt={item.nameEn} />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (roomError) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <PhoneLayout>
          <div className="phone-card grid gap-[12px] text-center">
            <div className="text-[48px]">✕</div>
            <h1 className="text-[var(--ink)] text-[22px] font-[800] m-0">
              {roomError.includes("closed") ? "Room closed" : "Room not found"}
            </h1>
            <p className="text-[var(--muted)] text-[14px] m-0">Ask the host for a new code.</p>
          </div>
        </PhoneLayout>
      </motion.div>
    );
  }

  if (!room) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <PhoneLayout>
          <div className="phone-card text-center">
            <p className="text-[var(--muted)] text-[14px] m-0">Loading room…</p>
          </div>
        </PhoneLayout>
      </motion.div>
    );
  }

  const tabItems: AvatarCatalogItem[] =
    activeTab === "characterId"
      ? (catalog?.characters ?? [])
      : activeTab === "hatId"
      ? (catalog?.hats ?? [])
      : (catalog?.decorations ?? []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
      <PhoneLayout>
        <form className="phone-card grid gap-[18px]" onSubmit={handleSubmit}>
          <div>
            <h1 className="text-[var(--ink)] text-[22px] font-[800] m-0 mb-[6px]">
              Join {code}
            </h1>
            <p className="text-[var(--muted)] text-[14px] m-0">
              Build your player and enter a nickname.
            </p>
          </div>

          {/* Avatar composer */}
          <div className="avatar-composer">
            {/* Preview */}
            <div className="avatar-preview-card">
              <div className="avatar-preview-stage">
                <AvatarStack avatar={avatar.characterId ? avatar : null} size="hero" />
              </div>
            </div>

            {/* Category tabs */}
            <div className="avatar-step-tabs">
              {(["characterId", "hatId", "decorationId"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={["avatar-step-tab", activeTab === tab ? "active" : ""].join(" ")}
                  onClick={() => setActiveTab(tab)}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            {/* Item grid for active tab */}
            {catalog ? renderGrid(activeTab, tabItems) : catalogError ? (
              <div className="avatar-choice-group">
                <p className="text-[#f67272] text-[13px] text-center py-[16px] m-0">
                  Could not load avatars. Please reload the page.
                </p>
              </div>
            ) : (
              <div className="avatar-choice-group">
                <p className="text-[var(--muted)] text-[13px] text-center py-[16px] m-0">Loading…</p>
              </div>
            )}

            {/* Palette picker */}
            <div className="grid gap-[8px]">
              <span className="text-[#c8d4de] text-[13px] font-[700]">Color</span>
              <div className="flex flex-wrap gap-[8px]">
                {PALETTES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={[
                      "w-[34px] h-[34px] rounded-full border-[3px] cursor-pointer transition-[box-shadow]",
                      avatar.paletteId === p.id
                        ? "border-white [box-shadow:0_0_0_2px_rgba(255,255,255,.4)]"
                        : "border-transparent",
                    ].join(" ")}
                    style={{ background: p.fill }}
                    onClick={() => setAvatar((prev) => ({ ...prev, paletteId: p.id }))}
                    aria-label={p.id}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Nickname */}
          <label className="grid gap-[8px]">
            <span className="text-[#c8d4de] text-[13px] font-[700]">Nickname</span>
            <input
              className={[
                "w-full min-h-[48px] px-[14px] rounded-[6px]",
                "border border-white/[.12] bg-[rgba(23,29,37,.74)]",
                "text-[var(--ink)] text-[16px]",
                "focus:outline-none focus:border-[rgba(120,212,94,.7)]",
              ].join(" ")}
              name="nickname"
              maxLength={24}
              placeholder="Alex"
              value={nickname}
              onChange={(e) => { setNickname(e.target.value); setJoinError(""); }}
              autoComplete="nickname"
            />
          </label>

          {joinError && (
            <p className="text-[#f67272] text-[13px] m-0">{joinError}</p>
          )}

          <Button variant="primary" className="w-full" type="submit" disabled={submitting || !avatar.characterId}>
            <Icon name="login" />
            <span>{submitting ? "Joining…" : "Join room"}</span>
          </Button>
        </form>
      </PhoneLayout>
    </motion.div>
  );
}
