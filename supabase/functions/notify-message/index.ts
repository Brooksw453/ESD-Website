// Supabase Edge Function: notify-message
// ---------------------------------------------------------------------------
// Emails bwinchell@esdesigns.org on every new row in `messages` and `waitlist`
// so no contact / inline form / email-capture submission is ever missed. The
// email is generated server-side from the DB row, so it fires even if the
// visitor closes the tab — and the row is always in Supabase as a backstop.
//
// SETUP (one-time):
//   1. Create a Resend account (https://resend.com), verify the esdesigns.org
//      sending domain (add the DNS records Resend gives you). For a quick test
//      before DNS propagates you can set NOTIFY_FROM to "onboarding@resend.dev".
//   2. Deploy this function (DB webhooks don't send a Supabase JWT, so disable
//      JWT verification — it is instead protected by WEBHOOK_SECRET below):
//        supabase functions deploy notify-message --no-verify-jwt
//   3. Set secrets:
//        supabase secrets set \
//          RESEND_API_KEY="re_..." \
//          WEBHOOK_SECRET="<any long random string>" \
//          NOTIFY_FROM="ES Designs <notifications@esdesigns.org>" \
//          NOTIFY_TO="bwinchell@esdesigns.org"
//   4. Supabase Dashboard -> Database -> Webhooks -> Create:
//        - Table: public.messages, Events: INSERT
//        - Type: HTTP Request, Method: POST
//        - URL: https://awcmkderlpyxpkmrnvwi.supabase.co/functions/v1/notify-message
//        - HTTP header: x-webhook-secret = <same WEBHOOK_SECRET>
//      Repeat for public.waitlist.
// ---------------------------------------------------------------------------

interface WebhookPayload {
  type: string;
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const NOTIFY_TO = Deno.env.get("NOTIFY_TO") ?? "bwinchell@esdesigns.org";
const NOTIFY_FROM = Deno.env.get("NOTIFY_FROM") ??
  "ES Designs <onboarding@resend.dev>";

// Human-readable labels for the source values the site sends.
const SOURCE_LABELS: Record<string, string> = {
  "contact-widget": "Get In Touch widget",
  "education-inquiry": "Education — talk to us",
  "ally-institutional": "Document Ally — institutional license",
  "courses-inquiry": "Adaptive Learning — demo request",
  "wcag-course-institutional": "WCAG 2.2 Course — institutional inquiry",
  "audit-free-scan": "Free single-page audit request",
  "audit-contact": "Audit tool — report/monitoring inquiry",
  "title-ii-briefing": "Title II Briefing — newsletter signup",
};

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildEmail(table: string, record: Record<string, unknown>) {
  const source = String(record.source ?? "");
  const sourceLabel = SOURCE_LABELS[source] ??
    (table === "waitlist" ? "Document Ally Pro waitlist" : source || table);

  const who = (record.name as string) || (record.email as string) ||
    "Unknown sender";
  const subject = `New ${sourceLabel} — ${who}`;

  // Show every non-empty field, with friendly labels, in submission order.
  const skip = new Set(["id", "created_at"]);
  const rows = Object.entries(record)
    .filter(([k, v]) =>
      !skip.has(k) && v !== null && v !== "" && v !== undefined
    )
    .map(([k, v]) =>
      `<tr><td style="padding:6px 12px;font-weight:600;color:#1F3D5C;vertical-align:top;white-space:nowrap">${
        esc(k)
      }</td><td style="padding:6px 12px;color:#1F2937">${esc(v)}</td></tr>`
    )
    .join("");

  const when = record.created_at
    ? new Date(String(record.created_at)).toLocaleString("en-US", {
      timeZone: "America/New_York",
    })
    : new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  const html = `<div style="font-family:'IBM Plex Sans',Arial,sans-serif;max-width:560px;margin:0 auto">
    <h2 style="color:#1F3D5C;margin:0 0 4px">New submission from esdesigns.org</h2>
    <p style="color:#5B6470;margin:0 0 16px">${esc(sourceLabel)} &middot; ${
    esc(when)
  } ET &middot; table: ${esc(table)}</p>
    <table style="border-collapse:collapse;width:100%;border:1px solid #E5E7EB;border-radius:8px">${rows}</table>
    <p style="color:#5B6470;font-size:13px;margin:16px 0 0">Reply directly to this email to respond to ${
    esc(record.email ?? "the sender")
  }. A copy is stored in Supabase (${esc(table)}).</p>
  </div>`;

  const text = Object.entries(record)
    .filter(([k, v]) => !skip.has(k) && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Reject anything that isn't our configured DB webhook.
  if (
    !WEBHOOK_SECRET ||
    req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const record = payload.record;
  if (payload.type !== "INSERT" || !record) {
    // Nothing to notify about (not an insert / no row).
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not set — cannot send notification email");
    return new Response("Email provider not configured", { status: 500 });
  }

  const { subject, html, text } = buildEmail(payload.table, record);
  const replyTo = typeof record.email === "string" && record.email
    ? record.email
    : undefined;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: NOTIFY_FROM,
      to: [NOTIFY_TO],
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Resend send failed:", res.status, detail);
    // 500 so the Supabase webhook records a failed delivery you can retry.
    return new Response(`Resend error: ${res.status}`, { status: 500 });
  }

  return new Response(JSON.stringify({ sent: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
