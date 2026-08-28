import { invoiceLabel, type ResolvedCareInvoiceTemplate } from "@/lib/care-invoice-settings";
import type { CareInvoiceViewModel } from "@/lib/care-invoice-view-model";

function money(prefix: string, n: number) {
  const formatted = n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${prefix} ${formatted}`;
}

type MemoCtx = {
  vm: CareInvoiceViewModel;
  template: ResolvedCareInvoiceTemplate;
  lang: "bn" | "en";
  L: (key: Parameters<typeof invoiceLabel>[1]) => string;
};

function InvoiceTotals({ vm, template, L, lang }: MemoCtx) {
  const { style, defaults } = template;
  const isOp = vm.kind === "operation";
  const labelPrice = isOp ? (lang === "bn" ? "মূল্য" : "Price") : L("total");
  const labelDiscount = isOp ? (lang === "bn" ? "ছাড়" : "Discount") : L("discount");
  const labelTotal = isOp ? (lang === "bn" ? "মোট" : "Total") : L("payable");

  return (
    <div className="cm-totals">
      <div className="cm-tot-row">
        <span>{labelPrice}</span>
        <span>{vm.money.subtotal.toFixed(2)}</span>
      </div>
      <div className="cm-tot-row cm-disc-total">
        <span>
          {labelDiscount}
          {vm.money.discount_percent > 0
            ? ` (${vm.money.discount_percent % 1 === 0 ? vm.money.discount_percent : vm.money.discount_percent.toFixed(1)}%)`
            : ""}
        </span>
        <span>{vm.money.discount_amount.toFixed(2)}</span>
      </div>
      {style.show_vat && (
        <div className="cm-tot-row">
          <span>
            {L("vat")} {vm.money.vat_percent.toFixed(2)}%
          </span>
          <span>{vm.money.vat_amount.toFixed(2)}</span>
        </div>
      )}
      <div className="cm-tot-row cm-strong">
        <span>{labelTotal}</span>
        <span>{money(defaults.currency_prefix, vm.money.payable)}</span>
      </div>
    </div>
  );
}

function LabInvoiceBody({ vm, template, lang, L }: MemoCtx) {
  const { style, defaults } = template;
  return (
    <>
      <table className="cm-table">
        <thead>
          <tr>
            <th className="cm-sl">{L("col_sl")}</th>
            <th>{L("col_test_id")}</th>
            <th className="cm-name">{L("col_test_name")}</th>
            <th>{L("col_delivery")}</th>
            <th className="cm-amt">{L("col_amount")}</th>
            <th className="cm-disc">{L("col_discount")}</th>
          </tr>
        </thead>
        <tbody>
          {vm.lines.map((line, i) => (
            <tr key={line.id}>
              <td className="cm-sl">{i + 1}</td>
              <td>{line.test_id}</td>
              <td className="cm-name">{line.name}</td>
              <td>{line.delivery_date}</td>
              <td className="cm-amt">{line.amount.toFixed(2)}</td>
              <td className="cm-disc">
                {line.discount.toFixed(2)}
                {line.discount_percent != null && line.discount_percent > 0 ? (
                  <span className="cm-disc-pct">({line.discount_percent.toFixed(0)}%)</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="cm-bottom">
        <div className="cm-delivery">
          {vm.collection_datetime ? (
            <p>
              <b>{lang === "bn" ? "নমুনা সংগ্রহ" : "Sample collection"}:</b> {vm.collection_datetime}
            </p>
          ) : null}
          <p>
            <b>{L("delivery_time")}:</b> {vm.delivery_datetime || "—"}
          </p>
          {style.show_delivery_slots && (
            <div className="cm-slots">
              {defaults.delivery_slot_labels.map((slot) => (
                <label key={slot} className="cm-slot">
                  <span className="cm-check" /> {slot}
                </label>
              ))}
            </div>
          )}
        </div>
        <InvoiceTotals vm={vm} template={template} lang={lang} L={L} />
      </div>
    </>
  );
}

function SerialInvoiceBody({ vm, template, lang, L }: MemoCtx) {
  const rows = vm.serial_rows ?? [];
  const extra = vm.serial_extra;
  const onlineLabel = lang === "bn" ? "অনলাইন" : "Online";

  return (
    <>
      <table className="cm-table cm-table-serial">
        <thead>
          <tr>
            <th className="cm-sl">{L("col_serial_sl")}</th>
            <th>{L("col_serial_no")}</th>
            <th className="cm-name">{L("col_serial_doctor")}</th>
            <th>{L("col_serial_specialty")}</th>
            <th>{L("col_serial_date")}</th>
            <th>{L("col_serial_time")}</th>
            <th className="cm-amt">{L("col_serial_fee")}</th>
            <th className="cm-disc">{L("col_serial_discount")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id}>
              <td className="cm-sl">{i + 1}</td>
              <td>
                {row.serial_no}
                {row.online_serial_no != null ? (
                  <span className="cm-serial-online">
                    {" "}
                    ({onlineLabel} #{row.online_serial_no})
                  </span>
                ) : null}
              </td>
              <td className="cm-name">{row.doctor_name}</td>
              <td>{row.specialty}</td>
              <td>{row.session_date}</td>
              <td>{row.schedule_time}</td>
              <td className="cm-amt">{row.fee.toFixed(2)}</td>
              <td className="cm-disc">
                {row.discount.toFixed(2)}
                {row.discount_percent != null && row.discount_percent > 0 ? (
                  <span className="cm-disc-pct">({row.discount_percent.toFixed(0)}%)</span>
                ) : null}
                {row.is_second_visit ? (
                  <span className="cm-disc-pct">
                    {lang === "bn" ? " · ২য় ভিজিট" : " · 2nd visit"}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {extra && (extra.bmdc || extra.qualifications || extra.chamber) ? (
        <div className="cm-serial-extra">
          {extra.bmdc ? (
            <span>
              <b>{L("serial_bmdc")}:</b> {extra.bmdc}
            </span>
          ) : null}
          {extra.qualifications ? (
            <span>
              <b>{L("serial_qualifications")}:</b> {extra.qualifications}
            </span>
          ) : null}
          {extra.chamber ? (
            <span className="cm-grow">
              <b>{L("serial_chamber")}:</b> {extra.chamber}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="cm-bottom cm-bottom-serial">
        <InvoiceTotals vm={vm} template={template} lang={lang} L={L} />
      </div>
    </>
  );
}

function AmbulanceInvoiceBody({ vm, template, lang, L }: MemoCtx) {
  const rows = vm.ambulance_rows ?? [];
  const extra = vm.ambulance_extra;

  return (
    <>
      <table className="cm-table cm-table-ambulance">
        <thead>
          <tr>
            <th className="cm-sl">{L("col_amb_sl")}</th>
            <th>{L("col_amb_ref")}</th>
            <th className="cm-name">{L("col_amb_service")}</th>
            <th>{L("col_amb_mode")}</th>
            <th>{L("col_amb_distance")}</th>
            <th className="cm-amt">{L("col_amb_fare")}</th>
            <th className="cm-disc">{L("col_amb_discount")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id}>
              <td className="cm-sl">{i + 1}</td>
              <td>{row.reference_code}</td>
              <td className="cm-name">{row.service_name}</td>
              <td>{row.mode}</td>
              <td>{row.distance_km}</td>
              <td className="cm-amt">{row.amount.toFixed(2)}</td>
              <td className="cm-disc">
                {row.discount.toFixed(2)}
                {row.discount_percent != null && row.discount_percent > 0 ? (
                  <span className="cm-disc-pct">({row.discount_percent.toFixed(0)}%)</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {extra && (extra.pickup || extra.dropoff || extra.plate_no || extra.driver_name) ? (
        <div className="cm-amb-extra">
          {extra.pickup ? (
            <span className="cm-grow">
              <b>{L("amb_pickup")}:</b> {extra.pickup}
            </span>
          ) : null}
          {extra.dropoff ? (
            <span className="cm-grow">
              <b>{L("amb_dropoff")}:</b> {extra.dropoff}
            </span>
          ) : null}
          {extra.plate_no ? (
            <span>
              <b>{L("amb_vehicle")}:</b> {extra.plate_no}
            </span>
          ) : null}
          {extra.driver_name ? (
            <span>
              <b>{L("amb_driver")}:</b> {extra.driver_name}
              {extra.driver_phone ? ` · ${extra.driver_phone}` : ""}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="cm-bottom cm-bottom-ambulance">
        <InvoiceTotals vm={vm} template={template} lang={lang} L={L} />
      </div>
    </>
  );
}

function OperationInvoiceBody({ vm, template, lang, L }: MemoCtx) {
  const rows = vm.operation_rows ?? [];
  const extra = vm.operation_extra;
  const bn = lang === "bn";

  return (
    <>
      <table className="cm-table cm-table-operation">
        <thead>
          <tr>
            <th className="cm-sl">{L("col_sl")}</th>
            <th className="cm-name">{bn ? "অপারেশন / খাত" : "Operation / item"}</th>
            <th>{bn ? "কোড" : "Code"}</th>
            <th className="cm-amt">{L("col_amount")}</th>
            <th className="cm-disc">{L("col_discount")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className={row.is_breakdown ? "cm-op-sub" : undefined}>
              <td className="cm-sl">{row.is_breakdown ? "" : i + 1}</td>
              <td className="cm-name">{row.is_breakdown ? `— ${row.name}` : row.name}</td>
              <td>{row.code || ""}</td>
              <td className="cm-amt">{row.amount.toFixed(2)}</td>
              <td className="cm-disc">
                {row.is_breakdown ? (
                  ""
                ) : (
                  <>
                    {row.discount.toFixed(2)}
                    {row.discount_percent != null && row.discount_percent > 0 ? (
                      <span className="cm-disc-pct">({row.discount_percent.toFixed(0)}%)</span>
                    ) : null}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {extra && extra.doctors.length ? (
        <div className="cm-serial-extra">
          {extra.doctors.map((d, i) => (
            <span key={i} className="cm-grow">
              <b>{d.role === "lead_surgeon" ? (bn ? "প্রধান সার্জন" : "Lead surgeon") : bn ? "সহযোগী" : "Team"}:</b>{" "}
              {d.name}
              {d.bmdc_no ? ` · BMDC ${d.bmdc_no}` : ""}
              {d.qualifications ? ` · ${d.qualifications}` : ""}
            </span>
          ))}
        </div>
      ) : null}

      <div className="cm-bottom">
        <div className="cm-delivery">
          <p>
            <b>{bn ? "অপারেশনের তারিখ ও সময়" : "Operation date & time"}:</b>{" "}
            {extra?.schedule_datetime ||
              (bn ? "ডেস্ক থেকে নিশ্চিত করা হবে" : "To be confirmed by the desk")}
          </p>
          {extra?.admission_date ? (
            <p>
              <b>{bn ? "ভর্তির তারিখ" : "Admission date"}:</b> {extra.admission_date}
            </p>
          ) : null}
          {extra?.clinic ? (
            <p>
              <b>{bn ? "স্থান" : "Venue"}:</b> {extra.clinic}
            </p>
          ) : null}
          {extra?.includes ? (
            <p>
              <b>{bn ? "প্যাকেজে অন্তর্ভুক্ত" : "Package includes"}:</b> {extra.includes}
            </p>
          ) : null}
          {extra?.prep ? (
            <p>
              <b>{bn ? "প্রস্তুতি" : "Preparation"}:</b> {extra.prep}
            </p>
          ) : null}
        </div>
        <InvoiceTotals vm={vm} template={template} lang={lang} L={L} />
      </div>
    </>
  );
}

/** Cash Memo / Bill — colorful on screen; print pipeline forces B&W; PDF keeps color. */
export function CareCashMemoInvoice({
  vm,
  template,
  lang,
}: {
  vm: CareInvoiceViewModel;
  template: ResolvedCareInvoiceTemplate;
  lang: "bn" | "en";
}) {
  const L = (key: Parameters<typeof invoiceLabel>[1]) => invoiceLabel(template, key, lang);
  const { letterhead, style, visibility } = template;
  const orgName = lang === "bn" ? letterhead.display_name_bn || letterhead.display_name : letterhead.display_name;
  const phones = letterhead.phones.join(", ");
  const contact = [
    phones ? `Mob: ${phones}` : null,
    letterhead.email ? `E-mail: ${letterhead.email}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const printNow = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const scale = style.font_scale || 1;
  const isSerial = vm.kind === "serial";
  const isAmbulance = vm.kind === "ambulance";
  const isOperation = vm.kind === "operation";
  const claimLabel = isSerial
    ? L("serial_claim_code")
    : isAmbulance
      ? L("ambulance_ref_code")
      : isOperation
        ? lang === "bn"
          ? "রেফারেন্স"
          : "Reference"
        : L("lab_id");
  const titleText = isAmbulance
    ? L("title_ambulance")
    : isOperation
      ? lang === "bn"
        ? "অপারেশন বিল"
        : "Operation Bill"
      : L("title");
  const disclaimerText = isAmbulance ? L("amb_disclaimer") : L("disclaimer");
  const ctx: MemoCtx = { vm, template, lang, L };

  return (
    <>
      <style>{`
.cash-memo{max-width:720px;margin:0 auto;background:#fff;color:#1e293b;border:2px solid #0f766e;padding:14px 16px;font-family:"Times New Roman",Times,serif;border-radius:4px;box-shadow:0 8px 24px rgba(15,118,110,.12)}
.cm-head{display:flex;gap:12px;align-items:flex-start;margin-bottom:8px;padding:10px 12px;border-radius:4px;background:linear-gradient(135deg,#0f766e 0%,#115e59 55%,#134e4a 100%);color:#fff}
.cm-logo{width:64px;height:64px;object-fit:contain;flex-shrink:0;background:#fff;border-radius:8px;padding:4px}
.cm-logo-fallback{width:64px;height:64px;border:2px solid #fff;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:22px;background:rgba(255,255,255,.2);color:#fff}
.cm-head-text{flex:1;text-align:center;min-width:0}
.cm-org{font-size:1.25rem;font-weight:800;letter-spacing:.02em;text-transform:uppercase;line-height:1.2;color:#fff}
.cm-addr,.cm-contact{font-size:.75rem;margin-top:2px;color:#ccfbf1}
.cm-rule{border-top:2px solid #0f766e;margin:8px 0}
.cm-title-box{display:flex;justify-content:center;margin:8px 0 10px}
.cm-title-box span{border:1px solid #0f766e;padding:4px 18px;font-weight:700;font-size:.875rem;background:#ccfbf1;color:#115e59;border-radius:4px}
.cm-meta{font-size:.75rem;margin-bottom:10px;background:#f0fdfa;padding:8px 10px;border-radius:4px;border:1px solid #99f6e4}
.cm-meta-row{display:flex;flex-wrap:wrap;gap:8px 16px;margin:3px 0}
.cm-grow{flex:1 1 12rem}
.cm-meta b{font-weight:700;color:#0f766e}
.cm-table{width:100%;border-collapse:collapse;font-size:.75rem;margin:8px 0 12px}
.cm-table th,.cm-table td{border-top:1px solid #99f6e4;border-bottom:1px solid #99f6e4;padding:6px 4px;text-align:left;vertical-align:top}
.cm-table thead th{border-top:2px solid #0f766e;border-bottom:2px solid #0f766e;font-weight:700;background:#0f766e;color:#fff}
.cm-table tbody tr:nth-child(even) td{background:#f8fafc}
.cm-table .cm-sl{width:2.2rem}.cm-table .cm-name{width:22%}
.cm-table .cm-amt,.cm-table th.cm-amt,.cm-table .cm-disc,.cm-table th.cm-disc{text-align:right;white-space:nowrap}
.cm-table .cm-disc{width:5rem;color:#047857;font-weight:600}
.cm-table .cm-amt{width:4rem}
.cm-table-serial{font-size:.7rem}
.cm-table-ambulance{font-size:.7rem}
.cm-table-operation{font-size:.72rem}
.cm-table-operation .cm-op-sub td{color:#475569;font-size:.95em}
.cm-table-operation .cm-op-sub .cm-name{padding-left:14px}
.cm-amb-extra{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:.7rem;margin:-4px 0 10px;padding:6px 8px;background:#f8fafc;border:1px solid #99f6e4;border-radius:4px}
.cm-amb-extra b{color:#0f766e}
.cm-bottom-ambulance{justify-content:flex-end}
.cm-serial-online{font-size:.85em;opacity:.85}
.cm-serial-extra{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:.7rem;margin:-4px 0 10px;padding:6px 8px;background:#f8fafc;border:1px solid #99f6e4;border-radius:4px}
.cm-serial-extra b{color:#0f766e}
.cm-disc-pct{display:inline;font-size:inherit;opacity:.85;margin-left:2px;font-weight:500}
.cm-bottom{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-top:8px;flex-wrap:wrap}
.cm-bottom-serial{justify-content:flex-end}
.cm-delivery{flex:1;font-size:.75rem;min-width:10rem}
.cm-slots{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}
.cm-slot{display:inline-flex;align-items:center;gap:4px}
.cm-check{width:12px;height:12px;border:1px solid #0f766e;display:inline-block}
.cm-totals{min-width:12rem;font-size:.75rem;padding:8px 10px;border:1px solid #99f6e4;border-radius:4px;background:#fff}
.cm-tot-row{display:flex;justify-content:space-between;gap:12px;padding:3px 0}
.cm-tot-row.cm-disc-total span:last-child{color:#047857;font-weight:600}
.cm-strong{font-weight:800;margin-top:2px;background:#ecfdf5;color:#065f46;padding:4px 6px;margin:4px -6px 0;border-radius:3px}
.cm-sign{margin-top:28px;text-align:right;font-size:.75rem}
.cm-sign-line{display:inline-block;width:10rem;border-top:1px solid #0f766e;margin-bottom:4px}
.cm-foot{margin-top:16px;font-size:.7rem;border-top:1px solid #99f6e4;padding-top:8px}
.cm-thanks{font-weight:600;margin-bottom:4px;color:#0f766e}.cm-disclaimer{margin-bottom:8px;line-height:1.35}
.cm-foot-meta{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:.65rem;color:#64748b}
@media print{
  .cash-memo{border-color:#111!important;box-shadow:none!important;border-radius:0!important;color:#111!important}
  .cm-head{background:#fff!important;color:#111!important;padding:0!important}
  .cm-org,.cm-addr,.cm-contact,.cm-thanks,.cm-meta b,.cm-serial-extra b,.cm-amb-extra b{color:#111!important}
  .cm-logo{background:transparent!important;padding:0!important}
  .cm-logo-fallback{border-color:#111!important;background:#fafafa!important;color:#111!important}
  .cm-title-box span{background:#fff!important;color:#111!important;border-color:#111!important}
  .cm-meta,.cm-serial-extra,.cm-amb-extra{background:#fff!important;border-color:#111!important;padding:0!important}
  .cm-table th,.cm-table td{border-color:#111!important}
  .cm-table thead th{background:#fff!important;color:#111!important}
  .cm-table tbody tr:nth-child(even) td{background:#fff!important}
  .cm-table-operation .cm-op-sub td{color:#111!important}
  .cm-disc,.cm-tot-row.cm-disc-total span:last-child{color:#111!important;font-weight:400!important}
  .cm-totals{border-color:#111!important}
  .cm-strong{background:transparent!important;color:#111!important;padding:0!important;margin-top:2px!important}
  .cm-sign-line,.cm-check,.cm-rule{border-color:#111!important}
  .cm-foot{border-color:#999!important}
  .cm-foot-meta{color:#333!important}
}
`}</style>
      <article className="cash-memo" data-kind={vm.kind} style={{ fontSize: `${13 * scale}px` }}>
        <header className="cm-head">
          {style.show_logo && letterhead.logo_url ? (
            <img src={letterhead.logo_url} alt="" className="cm-logo" />
          ) : style.show_logo ? (
            <div className="cm-logo cm-logo-fallback" aria-hidden>
              {(orgName || "C").slice(0, 1).toUpperCase()}
            </div>
          ) : null}
          <div className="cm-head-text">
            <h1 className="cm-org">{orgName}</h1>
            {letterhead.address ? <p className="cm-addr">{letterhead.address}</p> : null}
            {contact ? <p className="cm-contact">{contact}</p> : null}
          </div>
        </header>

        <div className="cm-rule" />

        <div className="cm-title-box">
          <span>{titleText}</span>
        </div>

        <div className={`cm-meta ${style.dense_meta ? "cm-meta-dense" : ""}`}>
          <div className="cm-meta-row">
            {visibility.reg_no ? (
              <span>
                <b>{L("reg_no")}:</b> {vm.reg_no || "—"}
              </span>
            ) : null}
            {visibility.lab_id ? (
              <span>
                <b>{claimLabel}:</b> {vm.lab_id || "—"}
              </span>
            ) : null}
            <span>
              <b>{L("date")}:</b> {vm.date}
            </span>
            {visibility.age ? (
              <span>
                <b>{L("age")}:</b> {vm.patient_age || "—"}
              </span>
            ) : null}
          </div>
          <div className="cm-meta-row">
            <span className="cm-grow">
              <b>{L("patient_name")}:</b> {vm.patient_name}
            </span>
            {visibility.sex ? (
              <span>
                <b>{L("sex")}:</b>{" "}
                {vm.patient_sex === "M"
                  ? lang === "bn"
                    ? "পুরুষ"
                    : "Male"
                  : vm.patient_sex === "F"
                    ? lang === "bn"
                      ? "নারী"
                      : "Female"
                    : vm.patient_sex === "O"
                      ? lang === "bn"
                        ? "অন্যান্য"
                        : "Other"
                      : vm.patient_sex || "—"}
              </span>
            ) : null}
          </div>
          <div className="cm-meta-row">
            {visibility.address ? (
              <span className="cm-grow">
                <b>{L("address")}:</b> {vm.patient_address || "—"}
              </span>
            ) : null}
            <span>
              <b>{L("mobile")}:</b> {vm.patient_phone}
            </span>
          </div>
          {visibility.refd_by ? (
            <div className="cm-meta-row">
              <span className="cm-grow">
                <b>{L("refd_by")}:</b> {vm.referred_by || "—"}
              </span>
            </div>
          ) : null}
        </div>

        {isSerial ? (
          <SerialInvoiceBody {...ctx} />
        ) : isAmbulance ? (
          <AmbulanceInvoiceBody {...ctx} />
        ) : isOperation ? (
          <OperationInvoiceBody {...ctx} />
        ) : (
          <LabInvoiceBody {...ctx} />
        )}

        {style.show_signature && (
          <div className="cm-sign">
            <div className="cm-sign-line" />
            <p>{L("signature")}</p>
          </div>
        )}

        <footer className="cm-foot">
          <p className="cm-thanks">{L("thanks")}</p>
          <p className="cm-disclaimer">{disclaimerText}</p>
          <div className="cm-foot-meta">
            {style.show_developer ? <span>{L("developed_by")}</span> : <span />}
            {style.show_print_datetime ? (
              <span>
                {L("print_datetime")}: {printNow} · {L("page_of")} 1 of 1
              </span>
            ) : null}
          </div>
        </footer>
      </article>
    </>
  );
}
