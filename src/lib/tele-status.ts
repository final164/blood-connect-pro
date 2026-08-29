/** Dynamic BN/EN labels for tele booking statuses — CMS can override via tele_settings.ui later */

export const TELE_STATUS_LABELS: Record<string, { bn: string; en: string }> = {
  pending_payment: { bn: "পেমেন্ট বাকি", en: "Payment pending" },
  confirmed: { bn: "নিশ্চিত", en: "Confirmed" },
  ready: { bn: "যোগ দিতে প্রস্তুত", en: "Ready to join" },
  in_call: { bn: "কল চলছে", en: "In call" },
  completed: { bn: "সম্পন্ন", en: "Completed" },
  cancelled: { bn: "বাতিল", en: "Cancelled" },
  no_show: { bn: "আসেননি", en: "No-show" },
};

export const TELE_PAYMENT_LABELS: Record<string, { bn: string; en: string }> = {
  pending: { bn: "বাকি", en: "Pending" },
  paid: { bn: "পরিশোধিত", en: "Paid" },
  waived: { bn: "মওকুফ", en: "Waived" },
  refunded: { bn: "রিফান্ড", en: "Refunded" },
};

export function teleStatusLabel(status: string, bn: boolean): string {
  const hit = TELE_STATUS_LABELS[status];
  if (hit) return bn ? hit.bn : hit.en;
  return status.replace(/_/g, " ");
}

export function telePaymentLabel(status: string, bn: boolean): string {
  const hit = TELE_PAYMENT_LABELS[status];
  if (hit) return bn ? hit.bn : hit.en;
  return status;
}

export function teleStatusTone(status: string): string {
  switch (status) {
    case "confirmed":
    case "ready":
      return "bg-sky-100 text-sky-800";
    case "in_call":
      return "bg-emerald-100 text-emerald-800";
    case "completed":
      return "bg-slate-100 text-slate-700";
    case "pending_payment":
      return "bg-amber-100 text-amber-900";
    case "cancelled":
    case "no_show":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-muted text-muted-foreground";
  }
}
