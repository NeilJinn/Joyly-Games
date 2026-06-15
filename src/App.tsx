import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import HomePage from "./pages/platform/HomePage";
import GamesPage from "./pages/platform/GamesPage";
import HowToPlayPage from "./pages/platform/HowToPlayPage";
import SupportPage from "./pages/platform/SupportPage";
import CompanyPage from "./pages/platform/CompanyPage";
import LobbyPage from "./pages/platform/LobbyPage";
import JoinPage from "./pages/player/JoinPage";
import AvatarPage from "./pages/player/AvatarPage";
import WaitingPage from "./pages/player/WaitingPage";
import InRoomPage from "./pages/player/InRoomPage";
import CosmicTriviaBigScreen from "./pages/games/cosmic-trivia/BigScreenPage";
import CosmicTriviaPhone from "./pages/games/cosmic-trivia/PhonePage";
import FateWerewolfBigScreen from "./pages/games/fate-werewolf/BigScreenPage";
import FateWerewolfPhone from "./pages/games/fate-werewolf/PhonePage";
import NotFoundPage from "./pages/NotFoundPage";

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Platform — big screen */}
        <Route path="/" element={<HomePage />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/how-to-play" element={<HowToPlayPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/company" element={<CompanyPage />} />
        <Route path="/room/:code" element={<LobbyPage />} />

        {/* Player — phone */}
        <Route path="/join" element={<JoinPage />} />
        <Route path="/join/:code" element={<AvatarPage />} />
        <Route path="/play/:code" element={<InRoomPage />} />
        <Route path="/waiting/:code" element={<WaitingPage />} />

        {/* Games */}
        <Route path="/game/cosmic-trivia/:code" element={<CosmicTriviaBigScreen />} />
        <Route path="/game/cosmic-trivia/:code/phone" element={<CosmicTriviaPhone />} />
        <Route path="/game/fate-werewolf/:code" element={<FateWerewolfBigScreen />} />
        <Route path="/game/fate-werewolf/:code/phone" element={<FateWerewolfPhone />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
