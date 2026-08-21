import type { CareOrgSerialSettings, CareSerialBookingFieldKey, CareSerialBookingFields } from "@/lib/care-org-settings";
import { DEFAULT_BOOKING_FIELDS, fieldLabel } from "@/lib/care-org-settings";

const FIELD_KEYS: CareSerialBookingFieldKey[] = ["name", "phone", "age", "address"];

type Props = {
  lang: "bn" | "en";
  value: CareOrgSerialSettings;
  onChange: (next: CareOrgSerialSettings) => void;
  disabled?: boolean;
  /** Platform defaults shown as hints when org field unset */
  platformApproval?: boolean;
  platformManual?: boolean;
  platformFields?: CareSerialBookingFields;
  /** Admin dark theme inputs */
  variant?: "desk" | "admin";
};

export function CareSerialSettingsForm({
  lang,
  value,
  onChange,
  disabled,
  platformApproval = false,
  platformManual = true,
  platformFields = DEFAULT_BOOKING_FIELDS,
  variant = "desk",
}: Props) {
  const labelCls = variant === "admin" ? "text-xs text-slate-200" : "text-sm text-foreground";
  const hintCls = variant === "admin" ? "text-[10px] text-slate-500" : "text-[10px] text-muted-foreground";
  const boxCls =
    variant === "admin"
      ? "rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-3"
      : "rounded-2xl border bg-card p-3 space-y-3";

  const fields: CareSerialBookingFields = {
    ...platformFields,
    ...value.booking_fields,
  };

  return (
    <div className={boxCls}>
      <div>
        <p className={`font-semibold ${labelCls}`}>
          {lang === "bn" ? "সিরিয়াল অ্যাপ্রুভাল" : "Serial approval"}
        </p>
        <p className={hintCls}>
          {lang === "bn"
            ? "অন হলে অ্যাপ বুকিং চেম্বার অনুমোদনের অপেক্ষা করে; অফ হলে অটো সিরিয়াল।"
            : "On = app bookings wait for desk approval; Off = auto serial."}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className={`inline-flex items-center gap-2 ${labelCls}`}>
            <input
              type="radio"
              name="approval-mode"
              disabled={disabled}
              checked={value.desk_serial_approval === true}
              onChange={() => onChange({ ...value, desk_serial_approval: true })}
            />
            {lang === "bn" ? "ডেস্ক অ্যাপ্রুভাল" : "Desk approval"}
          </label>
          <label className={`inline-flex items-center gap-2 ${labelCls}`}>
            <input
              type="radio"
              name="approval-mode"
              disabled={disabled}
              checked={value.desk_serial_approval === false}
              onChange={() => onChange({ ...value, desk_serial_approval: false })}
            />
            {lang === "bn" ? "অটো অ্যাপ্রুভ" : "Auto approve"}
          </label>
          <label className={`inline-flex items-center gap-2 ${labelCls}`}>
            <input
              type="radio"
              name="approval-mode"
              disabled={disabled}
              checked={value.desk_serial_approval === undefined}
              onChange={() => {
                const next = { ...value };
                delete next.desk_serial_approval;
                onChange(next);
              }}
            />
            {lang === "bn"
              ? `প্ল্যাটফর্ম ডিফল্ট (${platformApproval ? "অ্যাপ্রুভাল" : "অটো"})`
              : `Platform default (${platformApproval ? "approval" : "auto"})`}
          </label>
        </div>
      </div>

      <label className={`flex items-start justify-between gap-3 ${labelCls}`}>
        <span>
          <span className="font-semibold block">
            {lang === "bn" ? "Create Serial ট্যাব" : "Create Serial tab"}
          </span>
          <span className={hintCls}>
            {lang === "bn"
              ? "ডেস্কে নাম/মোবাইল/বয়স/ঠিকানা দিয়ে সিরিয়াল তৈরি"
              : "Create serials on desk with name/mobile/age/address"}
            {` · platform: ${platformManual ? "on" : "off"}`}
          </span>
        </span>
        <input
          type="checkbox"
          className="mt-1"
          disabled={disabled}
          checked={value.manual_patient_serial !== false}
          onChange={(e) => onChange({ ...value, manual_patient_serial: e.target.checked })}
        />
      </label>

      <div>
        <p className={`font-semibold ${labelCls}`}>
          {lang === "bn" ? "বুকিং ফর্ম ফিল্ড" : "Booking form fields"}
        </p>
        <p className={hintCls}>
          {lang === "bn"
            ? "অ্যাপ সিরিয়াল বুকিং ও ডেস্ক ম্যানুয়াল ফর্মে কোন তথ্য চাইবে"
            : "Which patient fields appear on app booking and desk manual form"}
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {FIELD_KEYS.map((key) => (
            <label key={key} className={`inline-flex items-center gap-2 ${labelCls}`}>
              <input
                type="checkbox"
                disabled={disabled || key === "name"}
                checked={fields[key]}
                onChange={(e) =>
                  onChange({
                    ...value,
                    booking_fields: { ...value.booking_fields, [key]: e.target.checked },
                  })
                }
              />
              {fieldLabel(key, lang)}
              {key === "name" && (
                <span className={hintCls}>({lang === "bn" ? "বাধ্যতামূলক" : "required"})</span>
              )}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
