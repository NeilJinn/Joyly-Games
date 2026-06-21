// Design-sync entry — re-exports all components as named exports.
// window.JoylyDS.<Name> references each component for preview rendering.
export { default as AccountMenu } from './src/components/platform/AccountMenu';
export { default as AnswerGrid } from './src/components/games/cosmic-trivia/AnswerGrid';
export { default as AuthModal } from './src/components/platform/AuthModal';
export { default as AvatarStack } from './src/components/player/AvatarStack';
export { default as Button } from './src/components/ui/Button';
export { default as ConfettiRain } from './src/components/ui/ConfettiRain';
export { default as CountdownBar } from './src/components/games/cosmic-trivia/CountdownBar';
export { default as CreateRoomButton } from './src/components/platform/CreateRoomButton';
export { default as GameCard } from './src/components/platform/GameCard';
export { default as GamePickerModal } from './src/components/platform/GamePickerModal';
export { default as HostPhoneLobbyView } from './src/components/platform/HostPhoneLobbyView';
export { default as Icon } from './src/components/ui/Icon';
export { default as Input } from './src/components/ui/Input';
export { default as JoinRoomForm } from './src/components/platform/JoinRoomForm';
export { default as Joyly01Overlay } from './src/components/ui/Joyly01Overlay';
export { default as LobbyControls } from './src/components/platform/LobbyControls';
export { default as Modal } from './src/components/ui/Modal';
export { default as NavBar } from './src/components/platform/NavBar';
export { default as PaymentModal } from './src/components/platform/PaymentModal';
export { default as PhoneLayout } from './src/components/player/PhoneLayout';
export { default as PhoneSadEmojiRain } from './src/components/games/cosmic-trivia/PhoneSadEmojiRain';
export { default as PlayerBubble } from './src/components/platform/PlayerBubble';
export { default as PlayerStage } from './src/components/platform/PlayerStage';
export { default as PreferencesPicker } from './src/components/games/cosmic-trivia/PreferencesPicker';
export { default as PromoRail } from './src/components/platform/PromoRail';
export { default as ScoreBurstOverlay } from './src/components/games/cosmic-trivia/ScoreBurstOverlay';
export { default as ScoreRow } from './src/components/games/cosmic-trivia/ScoreRow';
export { default as Tag } from './src/components/ui/Tag';
export { default as WinnerBoard } from './src/components/games/cosmic-trivia/WinnerBoard';

// Preview utilities — not real components, used by authored previews to set up context
export { MemoryRouter as __Router } from 'react-router-dom';
export { useAuthStore as __authStore } from './src/stores/authStore';
export { useRoomStore as __roomStore } from './src/stores/roomStore';
