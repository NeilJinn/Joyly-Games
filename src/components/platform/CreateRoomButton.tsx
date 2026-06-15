import Button from "../ui/Button";
import Icon from "../ui/Icon";

interface CreateRoomButtonProps {
  onClick: () => void;
}

export default function CreateRoomButton({ onClick }: CreateRoomButtonProps) {
  return (
    <Button
      variant="primary"
      className="w-full min-h-[92px] grid [grid-template-columns:46px_1fr] items-center gap-[12px] p-[12px] rounded-[8px] text-left justify-start"
      onClick={onClick}
    >
      <div className="w-[46px] h-[46px] grid place-items-center rounded-[8px] text-[var(--outline)] [background:linear-gradient(135deg,var(--sun),var(--green))]">
        <Icon name="play" className="w-[26px] h-[26px]" />
      </div>
      <span>
        <strong className="block text-[19px] leading-[1.15] text-[var(--outline)] mt-[4px]">
          Start a Jam
        </strong>
      </span>
    </Button>
  );
}
