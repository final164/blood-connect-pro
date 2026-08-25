import { invoiceLabel, type ResolvedCareInvoiceTemplate } from "@/lib/care-invoice-settings";
import type { CareInvoiceViewModel } from "@/lib/care-invoice-view-model";

function money(prefix: string, n: number) {
  const formatted = n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${prefix} ${formatted}`;
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
  const { letterhead, style, defaults, visibility } = template;
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
.cm-table .cm-sl{width:2.2rem}.cm-table .cm-name{width:34%}
.cm-table .cm-amt,.cm-table th.cm-amt,.cm-table .cm-disc,.cm-table th.cm-disc{text-align:right;white-space:nowrap}
.cm-table .cm-disc{width:5.5rem;color:#047857;font-weight:600}
.cm-table .cm-amt{width:4.5rem}
.cm-disc-pct{display:inline;font-size:inherit;opacity:.85;margin-left:2px;font-weight:500}
.cm-bottom{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-top:8px;flex-wrap:wrap}
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
  .cm-org,.cm-addr,.cm-contact,.cm-thanks,.cm-meta b{color:#111!important}
  .cm-logo{background:transparent!important;padding:0!important}
  .cm-logo-fallback{border-color:#111!important;background:#fafafa!important;color:#111!important}
  .cm-title-box span{background:#fff!important;color:#111!important;border-color:#111!important}
  .cm-meta{background:#fff!important;border-color:#111!important;padding:0!important}
  .cm-table th,.cm-table td{border-color:#111!important}
  .cm-table thead th{background:#fff!important;color:#111!important}
  .cm-table tbody tr:nth-child(even) td{background:#fff!important}
  .cm-disc,.cm-tot-row.cm-disc-total span:last-child{color:#111!important;font-weight:400!important}
  .cm-totals{border-color:#111!important}
  .cm-strong{background:transparent!important;color:#111!important;padding:0!important;margin-top:2px!important}
  .cm-sign-line,.cm-check,.cm-rule{border-color:#111!important}
  .cm-foot{border-color:#999!important}
  .cm-foot-meta{color:#333!important}
}
`}</style>
      <article className="cash-memo" style={{ fontSize: `${13 * scale}px` }}>
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
          <span>{L("title")}</span>
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
                <b>{L("lab_id")}:</b> {vm.lab_id || "—"}
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
          <div className="cm-totals">
            <div className="cm-tot-row">
              <span>{L("total")}</span>
              <span>{vm.money.subtotal.toFixed(2)}</span>
            </div>
            <div className="cm-tot-row cm-disc-total">
              <span>{L("discount")}</span>
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
              <span>{L("payable")}</span>
              <span>{money(defaults.currency_prefix, vm.money.payable)}</span>
            </div>
          </div>
        </div>

        {style.show_signature && (
          <div className="cm-sign">
            <div className="cm-sign-line" />
            <p>{L("signature")}</p>
          </div>
        )}

        <footer className="cm-foot">
          <p className="cm-thanks">{L("thanks")}</p>
          <p className="cm-disclaimer">{L("disclaimer")}</p>
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
