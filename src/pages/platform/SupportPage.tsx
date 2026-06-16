import NavBar from "../../components/platform/NavBar";

export default function SupportPage() {
  return (
    <div className="min-h-screen pt-[52px]">
      <NavBar />
      <div className="flex items-center justify-center" style={{ minHeight: "calc(100vh - 52px)" }}>
        <p className="text-[var(--muted)]">Support — coming soon</p>
      </div>
    </div>
  );
}
