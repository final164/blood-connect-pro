export function ProfileToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between rounded-xl border bg-card px-3 py-3"
    >
      <span className="text-sm">{label}</span>
      <span className={`h-6 w-11 rounded-full p-0.5 transition ${checked ? "bg-primary" : "bg-muted"}`}>
        <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${checked ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}
