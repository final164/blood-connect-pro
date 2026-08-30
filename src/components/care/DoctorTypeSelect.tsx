import { CARE_DOCTOR_TYPES } from "@/lib/care-cms";

/** Shared doctor-type `<select>` for registration, chamber desk, and admin. */
export function DoctorTypeSelect({
  value,
  onChange,
  lang,
  className,
  disabled,
  required,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  lang: "bn" | "en";
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}) {
  const bn = lang === "bn";
  const known = CARE_DOCTOR_TYPES.some((t) => t.value === value);
  const legacy = value.trim() && !known ? value.trim() : null;

  return (
    <select
      id={id}
      className={className}
      value={value}
      disabled={disabled}
      required={required}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{bn ? "নির্বাচন করুন" : "Select"}</option>
      {legacy ? <option value={legacy}>{legacy}</option> : null}
      {CARE_DOCTOR_TYPES.map((t) => (
        <option key={t.value} value={t.value}>
          {bn ? t.label_bn : t.label_en}
        </option>
      ))}
    </select>
  );
}
