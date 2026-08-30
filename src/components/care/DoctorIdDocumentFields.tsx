import {
  CARE_ID_DOCUMENT_KINDS,
  careIdDocumentNumberLabel,
  type CareIdDocumentKind,
} from "@/lib/care-doctor-id-document";

/** Select ID kind, then enter the matching number. */
export function DoctorIdDocumentFields({
  kind,
  number,
  onKindChange,
  onNumberChange,
  lang,
  className,
  disabled,
  required,
  selectClassName,
  inputClassName,
}: {
  kind: string;
  number: string;
  onKindChange: (kind: CareIdDocumentKind | "") => void;
  onNumberChange: (value: string) => void;
  lang: "bn" | "en";
  className?: string;
  disabled?: boolean;
  required?: boolean;
  selectClassName?: string;
  inputClassName?: string;
}) {
  const bn = lang === "bn";
  const meta = CARE_ID_DOCUMENT_KINDS.find((k) => k.value === kind);

  return (
    <div className={className ?? "grid gap-2 sm:grid-cols-2"}>
      <div>
        <label className="mb-0.5 block text-[10px] font-semibold text-muted-foreground">
          {bn ? "পরিচয়পত্রের ধরন" : "ID document type"}
          {required ? " *" : ""}
        </label>
        <select
          className={selectClassName}
          value={kind}
          disabled={disabled}
          required={required}
          onChange={(e) => onKindChange(e.target.value as CareIdDocumentKind | "")}
        >
          <option value="">{bn ? "নির্বাচন করুন" : "Select"}</option>
          {CARE_ID_DOCUMENT_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {bn ? k.label_bn : k.label_en}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-0.5 block text-[10px] font-semibold text-muted-foreground">
          {careIdDocumentNumberLabel(kind || null, lang)}
          {required ? " *" : ""}
        </label>
        <input
          className={inputClassName}
          value={number}
          disabled={disabled || !kind}
          required={required && !!kind}
          placeholder={meta?.placeholder ?? (bn ? "নম্বর" : "Number")}
          onChange={(e) => onNumberChange(e.target.value)}
        />
      </div>
    </div>
  );
}
