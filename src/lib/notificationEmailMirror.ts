import { Resend } from "resend";

export type NotificationEmailRow = {
  id: number;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
};

export type NotificationEmailRecipient = {
  email: string;
  fullName: string | null;
};

type SendNotificationEmailInput = {
  notification: NotificationEmailRow;
  recipient: NotificationEmailRecipient;
  siteUrl: string;
};

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  return new Resend(apiKey);
}

function getNotificationEmailFrom() {
  return process.env.RENTULO_EMAIL_FROM?.trim() ?? "";
}

function getNotificationEmailReplyTo() {
  return process.env.RENTULO_EMAIL_REPLY_TO?.trim() ?? "";
}

export function isNotificationEmailMirrorConfigured() {
  return Boolean(getResendClient() && getNotificationEmailFrom());
}

function getNotificationTypeLabel(type: string) {
  if (type === "dispute") return "Reklamácia";
  if (type === "payment") return "Platba";
  if (type === "message") return "Správa";
  if (type === "reservation") return "Rezervácia";
  if (type === "verification") return "Overenie";
  if (type.startsWith("dispute_")) return "Reklamácia";
  if (type.startsWith("payment_")) return "Platba";
  if (type.startsWith("message_")) return "Správa";
  if (type.startsWith("reservation_")) return "Rezervácia";
  if (type.startsWith("verification_")) return "Overenie";
  return "Upozornenie";
}

function buildNotificationHref(link: string | null, siteUrl: string) {
  const normalizedSiteUrl = normalizeBaseUrl(siteUrl);

  if (!link) {
    return `${normalizedSiteUrl}/notifications`;
  }

  if (link.startsWith("http://") || link.startsWith("https://")) {
    return link;
  }

  if (link.startsWith("/")) {
    return `${normalizedSiteUrl}${link}`;
  }

  return `${normalizedSiteUrl}/${link}`;
}

function buildEmailSubject(notification: NotificationEmailRow) {
  return `Rentulo • ${notification.title}`;
}

function buildEmailGreeting(recipient: NotificationEmailRecipient) {
  if (recipient.fullName?.trim()) {
    return `Ahoj ${recipient.fullName.trim()},`;
  }

  return "Ahoj,";
}

function buildEmailText(input: SendNotificationEmailInput) {
  const { notification, recipient, siteUrl } = input;
  const href = buildNotificationHref(notification.link, siteUrl);
  const typeLabel = getNotificationTypeLabel(notification.type);
  const body = notification.body?.trim() || "V aplikácii máš nové upozornenie.";

  return [
    buildEmailGreeting(recipient),
    "",
    `v Rentulo máš nové upozornenie typu ${typeLabel.toLowerCase()}.`,
    "",
    notification.title,
    "",
    body,
    "",
    `Otvoriť: ${href}`,
    "",
    "Rentulo",
  ].join("\n");
}

function buildEmailHtml(input: SendNotificationEmailInput) {
  const { notification, recipient, siteUrl } = input;
  const href = buildNotificationHref(notification.link, siteUrl);
  const typeLabel = getNotificationTypeLabel(notification.type);
  const safeGreeting = escapeHtml(buildEmailGreeting(recipient));
  const safeTitle = escapeHtml(notification.title);
  const safeBody = escapeHtml(
    notification.body?.trim() || "V aplikácii máš nové upozornenie."
  ).replaceAll("\n", "<br />");
  const safeHref = escapeHtml(href);
  const safeTypeLabel = escapeHtml(typeLabel);

  return `
<!doctype html>
<html lang="sk">
  <body style="margin:0;padding:0;background:#0a0a0a;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="border:1px solid rgba(255,255,255,0.12);background:#111111;border-radius:24px;padding:32px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(99,102,241,0.16);border:1px solid rgba(99,102,241,0.35);color:#c7d2fe;font-size:12px;font-weight:600;">
          Rentulo • ${safeTypeLabel}
        </div>

        <h1 style="margin:18px 0 0;font-size:28px;line-height:1.2;color:#ffffff;">
          ${safeTitle}
        </h1>

        <p style="margin:18px 0 0;font-size:16px;line-height:1.7;color:#d4d4d8;">
          ${safeGreeting}
        </p>

        <p style="margin:12px 0 0;font-size:16px;line-height:1.7;color:#d4d4d8;">
          ${safeBody}
        </p>

        <div style="margin-top:28px;">
          <a
            href="${safeHref}"
            style="display:inline-block;padding:14px 18px;border-radius:14px;background:#ffffff;color:#000000;text-decoration:none;font-weight:700;"
          >
            Otvoriť upozornenie
          </a>
        </div>

        <p style="margin:28px 0 0;font-size:13px;line-height:1.7;color:#a1a1aa;">
          Tento e-mail je mirror upozornenia z aplikácie Rentulo.
        </p>
      </div>
    </div>
  </body>
</html>
  `.trim();
}

export async function sendNotificationMirrorEmail(input: SendNotificationEmailInput) {
  const resend = getResendClient();
  const from = getNotificationEmailFrom();
  const replyTo = getNotificationEmailReplyTo();

  if (!resend || !from) {
    return {
      ok: false as const,
      error: "Notification email mirror is not configured.",
    };
  }

  const subject = buildEmailSubject(input.notification);
  const html = buildEmailHtml(input);
  const text = buildEmailText(input);

  const { data, error } = await resend.emails.send(
    {
      from,
      to: [input.recipient.email],
      subject,
      html,
      text,
      replyTo: replyTo || undefined,
    },
    {
      idempotencyKey: `rentulo-notification/${input.notification.id}`,
    }
  );

  if (error) {
    const message =
      typeof error.message === "string" && error.message.trim()
        ? error.message
        : "Unknown Resend error.";

    return {
      ok: false as const,
      error: message,
    };
  }

  return {
    ok: true as const,
    emailId: data?.id ?? null,
  };
}
