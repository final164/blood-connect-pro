export function Avatar({ name, src, size = 40 }: { name?: string | null; src?: string; size?: number }) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className="rounded-full bg-primary/10 text-primary grid place-items-center font-semibold shrink-0 overflow-hidden ring-2 ring-background"
      style={{ height: size, width: size, fontSize: size * 0.38 }}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initial}
    </div>
  );
}
