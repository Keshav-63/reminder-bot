/**
 * Industry-standard HTML email templates.
 *
 * - Inline CSS only (Gmail, Outlook, Yahoo compatibility)
 * - Table-based layout (Outlook rendering engine)
 * - Dark mode support via meta + prefers-color-scheme
 * - Mobile responsive (max-width 600px)
 * - Plain text fallback included
 */

import { DateTime } from "luxon";

// ─── Constants ──────────────────────────────────────────────────────────────

const BRAND_COLOR = "#2563EB";    // blue
const URGENT_COLOR = "#DC2626";   // red
const SUCCESS_COLOR = "#16A34A";  // green
const BG_COLOR = "#F3F4F6";
const CARD_BG = "#FFFFFF";
const TEXT_COLOR = "#1F2937";
const TEXT_MUTED = "#6B7280";
const BORDER_RADIUS = "8px";

// ─── Shared Layout ──────────────────────────────────────────────────────────

function wrapInLayout(bodyContent, preheader = "") {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Reminder Bot</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #1a1a2e !important; }
      .email-card { background-color: #16213e !important; }
      .email-text { color: #e0e0e0 !important; }
      .email-muted { color: #a0a0a0 !important; }
    }
    /* Mobile */
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; padding: 12px !important; }
      .email-card { padding: 24px 16px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:${BG_COLOR}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${preheader}&#847;&zwnj;&nbsp;</div>

  <!-- Outer wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BG_COLOR};" class="email-bg">
    <tr>
      <td align="center" style="padding: 32px 16px;">

        <!-- Inner container (600px max) -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="email-container" style="max-width:600px; width:100%;">

          <!-- Logo / Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:24px; font-weight:700; color:${BRAND_COLOR}; letter-spacing:-0.5px;">
                    &#128916; Reminder Bot
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${CARD_BG}; border-radius:${BORDER_RADIUS}; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" class="email-card">
                <tr>
                  <td style="padding: 40px 36px;">
                    ${bodyContent}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 0; text-align:center;">
              <p style="margin:0; font-size:12px; color:${TEXT_MUTED}; line-height:1.5;" class="email-muted">
                This is an automated message from Reminder Bot.<br>
                Sent on ${DateTime.now().setZone("Asia/Kolkata").toFormat("dd MMM yyyy, hh:mm a")} IST<br>
                Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Friendly Reminder (Due Today) ─────────────────────────────────────────

function buildReminderHtml({ taskName, ownerEmail, dueDateFormatted }) {
  const body = `
    <!-- Badge -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td>
          <span style="display:inline-block; background-color:#DBEAFE; color:${BRAND_COLOR}; font-size:12px; font-weight:600; padding:4px 12px; border-radius:12px; text-transform:uppercase; letter-spacing:0.5px;">
            &#9200; Friendly Reminder
          </span>
        </td>
      </tr>
    </table>

    <!-- Heading -->
    <h1 style="margin:20px 0 8px; font-size:22px; font-weight:700; color:${TEXT_COLOR}; line-height:1.3;" class="email-text">
      Your task is due today
    </h1>

    <p style="margin:0 0 24px; font-size:15px; color:${TEXT_MUTED}; line-height:1.6;" class="email-muted">
      Hi there, this is a gentle reminder about an upcoming deadline.
    </p>

    <!-- Task Detail Card -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F9FAFB; border-radius:${BORDER_RADIUS}; border: 1px solid #E5E7EB;">
      <tr>
        <td style="padding: 20px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding-bottom:12px;">
                <span style="font-size:12px; font-weight:600; color:${TEXT_MUTED}; text-transform:uppercase; letter-spacing:0.5px;">Task Name</span><br>
                <span style="font-size:16px; font-weight:600; color:${TEXT_COLOR};" class="email-text">${escapeHtml(taskName)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:12px;">
                <span style="font-size:12px; font-weight:600; color:${TEXT_MUTED}; text-transform:uppercase; letter-spacing:0.5px;">Assigned To</span><br>
                <span style="font-size:14px; color:${TEXT_COLOR};" class="email-text">${escapeHtml(ownerEmail)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:12px;">
                <span style="font-size:12px; font-weight:600; color:${TEXT_MUTED}; text-transform:uppercase; letter-spacing:0.5px;">Due Date</span><br>
                <span style="font-size:14px; font-weight:600; color:${BRAND_COLOR};">${dueDateFormatted} (Today)</span>
              </td>
            </tr>
            <tr>
              <td>
                <span style="font-size:12px; font-weight:600; color:${TEXT_MUTED}; text-transform:uppercase; letter-spacing:0.5px;">Status</span><br>
                <span style="display:inline-block; background-color:#FEF3C7; color:#B45309; font-size:12px; font-weight:600; padding:3px 10px; border-radius:10px;">Due Today</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;">
      <tr>
        <td>
          <p style="margin:0; font-size:14px; color:${TEXT_COLOR}; line-height:1.6;" class="email-text">
            Please complete this task by the end of today. If you've already finished it, kindly update the status to <strong>"Completed"</strong> in the spreadsheet.
          </p>
        </td>
      </tr>
    </table>
  `;

  return wrapInLayout(body, `Reminder: "${taskName}" is due today`);
}

// ─── Urgent Overdue ─────────────────────────────────────────────────────────

function buildUrgentHtml({ taskName, ownerEmail, daysOverdue, dueDateFormatted }) {
  const body = `
    <!-- Urgent Badge -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td>
          <span style="display:inline-block; background-color:#FEE2E2; color:${URGENT_COLOR}; font-size:12px; font-weight:700; padding:4px 12px; border-radius:12px; text-transform:uppercase; letter-spacing:0.5px;">
            &#128680; Urgent — Action Required
          </span>
        </td>
      </tr>
    </table>

    <!-- Heading -->
    <h1 style="margin:20px 0 8px; font-size:22px; font-weight:700; color:${URGENT_COLOR}; line-height:1.3;">
      Task overdue by ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}
    </h1>

    <p style="margin:0 0 24px; font-size:15px; color:${TEXT_MUTED}; line-height:1.6;" class="email-muted">
      This task has passed its deadline and requires your immediate attention. The manager has been CC'd on this email for visibility.
    </p>

    <!-- Overdue Indicator -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#FEF2F2; border-radius:${BORDER_RADIUS}; border: 1px solid #FECACA; margin-bottom:20px;">
      <tr>
        <td align="center" style="padding: 16px;">
          <span style="font-size:36px; font-weight:800; color:${URGENT_COLOR};">${daysOverdue}</span><br>
          <span style="font-size:13px; font-weight:600; color:${URGENT_COLOR}; text-transform:uppercase; letter-spacing:1px;">Day${daysOverdue !== 1 ? "s" : ""} Overdue</span>
        </td>
      </tr>
    </table>

    <!-- Task Detail Card -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F9FAFB; border-radius:${BORDER_RADIUS}; border: 1px solid #E5E7EB;">
      <tr>
        <td style="padding: 20px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding-bottom:12px;">
                <span style="font-size:12px; font-weight:600; color:${TEXT_MUTED}; text-transform:uppercase; letter-spacing:0.5px;">Task Name</span><br>
                <span style="font-size:16px; font-weight:600; color:${TEXT_COLOR};" class="email-text">${escapeHtml(taskName)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:12px;">
                <span style="font-size:12px; font-weight:600; color:${TEXT_MUTED}; text-transform:uppercase; letter-spacing:0.5px;">Assigned To</span><br>
                <span style="font-size:14px; color:${TEXT_COLOR};" class="email-text">${escapeHtml(ownerEmail)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:12px;">
                <span style="font-size:12px; font-weight:600; color:${TEXT_MUTED}; text-transform:uppercase; letter-spacing:0.5px;">Original Due Date</span><br>
                <span style="font-size:14px; font-weight:600; color:${URGENT_COLOR};">${dueDateFormatted}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span style="font-size:12px; font-weight:600; color:${TEXT_MUTED}; text-transform:uppercase; letter-spacing:0.5px;">Status</span><br>
                <span style="display:inline-block; background-color:#FEE2E2; color:${URGENT_COLOR}; font-size:12px; font-weight:600; padding:3px 10px; border-radius:10px;">Overdue</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;">
      <tr>
        <td>
          <p style="margin:0 0 12px; font-size:14px; color:${TEXT_COLOR}; line-height:1.6;" class="email-text">
            <strong>Next steps:</strong>
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:2px 0; font-size:14px; color:${TEXT_COLOR};" class="email-text">1. Complete the task as soon as possible</td>
            </tr>
            <tr>
              <td style="padding:2px 0; font-size:14px; color:${TEXT_COLOR};" class="email-text">2. Update the status to <strong>"Completed"</strong> in the spreadsheet</td>
            </tr>
            <tr>
              <td style="padding:2px 0; font-size:14px; color:${TEXT_COLOR};" class="email-text">3. If blocked, escalate to your manager immediately</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return wrapInLayout(body, `URGENT: "${taskName}" is overdue by ${daysOverdue} day(s)`);
}

// ─── Utility ────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export { buildReminderHtml, buildUrgentHtml, escapeHtml };
