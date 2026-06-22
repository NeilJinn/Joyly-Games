import { useState } from "react";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { useAuthStore } from "../../stores/authStore";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated?: () => void;
}

export default function AuthModal({ open, onClose, onAuthenticated }: AuthModalProps) {
  const setAccount = useAuthStore((s) => s.setAccount);
  const [name, setName] = useState("Neil");
  const [email, setEmail] = useState("host@example.com");

  function handleSubmit() {
    if (!name.trim() || !email.trim()) return;
    setAccount({ displayName: name.trim(), email: email.trim() });
    onAuthenticated?.();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-[22px] font-[800] text-[var(--ink)] m-0 mb-[8px]">
        Host account
      </h2>
      <p className="text-[var(--muted)] text-[14px] mt-0 mb-[4px]">
        Sign in to choose a game and buy play time.
      </p>

      <div className="grid gap-[8px] my-[18px]">
        <label className="grid gap-[8px]" htmlFor="auth-name">
          <span className="text-[#c8d4de] text-[13px] font-[700]">
            Display name
          </span>
          <Input
            id="auth-name"
            name="hostName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
      </div>

      <div className="grid gap-[8px] my-[18px]">
        <label className="grid gap-[8px]" htmlFor="auth-email">
          <span className="text-[#c8d4de] text-[13px] font-[700]">Email</span>
          <Input
            id="auth-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
      </div>

      <Button
        variant="primary"
        className="w-full mt-[8px]"
        onClick={handleSubmit}
      >
        <Icon name="login" />
        <span>Continue</span>
      </Button>
    </Modal>
  );
}
