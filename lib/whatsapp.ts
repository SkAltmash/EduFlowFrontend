// WhatsApp messaging to parents. Messages are always built by the server from
// its own records; the browser only chooses who to message.

export type MessageType = "fee_receipt" | "fee_reminder" | "absence" | "attendance_summary" | "exam_result" | "progress_report" | "performance_report";

export type MessageRef =
  | { paymentId: string }
  | { studentId: string }
  | { studentId: string; date: string }
  | { studentId: string; month: string }
  | { examId: string; studentId: string }
  | { studentId: string; from: string; to: string; grade?: string; section?: string };

export interface LastSent {
  status: "opened" | "sent" | "delivered" | "read" | "failed";
  mode: "link" | "api";
  at: string;
  by: string | null;
  error: string | null;
}

export interface Recipient {
  refKey: string;
  studentId?: string;
  studentName?: string;
  guardianName?: string;
  to?: string;
  text?: string;
  link?: string;
  /** Why this person can't be messaged (no phone, nothing due…) */
  skip?: string;
  last: LastSent | null;
}

export interface PrepareResult {
  mode: "link" | "api";
  canSendAutomatically: boolean;
  recipients: Recipient[];
}

export interface SendResult {
  results: { refKey: string; studentName?: string; status: "sent" | "failed" | "skipped"; reason?: string }[];
  sent: number;
  failed: number;
  skipped: number;
}

export interface TemplateInfo {
  title: string;
  suggestedName: string;
  body: string;
  example: string[];
  name: string;
  language: string;
  params: number;
}

export interface WhatsAppSettings {
  mode: "link" | "api";
  defaultCountryCode: string;
  phoneNumberId: string;
  displayPhone: string;
  tokenSet: boolean;
  tokenReadable: boolean;
  encryptionAvailable: boolean;
  templates: Record<MessageType, TemplateInfo>;
  webhookUrl: string;
  webhookConfigured: boolean;
}

export const TYPE_LABEL: Record<MessageType, string> = {
  fee_receipt: "Fee receipt",
  fee_reminder: "Fee reminder",
  absence: "Absence alert",
  attendance_summary: "Attendance report",
  exam_result: "Test result",
  progress_report: "Progress report",
  performance_report: "Performance report",
};

/** Must match how the server keys each message (see buildRecipients in the API). */
export function refKeyOf(type: MessageType, ref: MessageRef) {
  if ("paymentId" in ref) return ref.paymentId;
  if ("from" in ref) return `perf:${ref.studentId}:${ref.from}:${ref.to}`;
  if ("examId" in ref) return `${ref.examId}:${ref.studentId}`;
  if ("date" in ref) return `${ref.studentId}:${ref.date}`;
  if ("month" in ref) return type === "progress_report" ? `progress:${ref.studentId}:${ref.month}` : `${ref.studentId}:${ref.month}`;
  return ref.studentId;
}

export const STATUS_LABEL: Record<LastSent["status"], string> = {
  opened: "Opened in WhatsApp",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
};

/** "just now", "5 min ago", "3 h ago", "2 days ago", then a date. */
export function timeAgo(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)} day${s < 2 * 86_400 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Was this already messaged recently enough that sending again is probably a duplicate? */
export function recentlySent(last: LastSent | null, hours = 24) {
  return Boolean(last && last.status !== "failed" && Date.now() - Date.parse(last.at) < hours * 3_600_000);
}
