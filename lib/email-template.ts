/**
 * Pure rendering for the confirmation email. No network, no env vars, so the
 * markup and the escaping can be asserted in tests.
 */

import { formatCents } from "./money";

export type ConfirmationItem = {
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export type ConfirmationInput = {
  to: string;
  recipientName: string | null;
  orderNumber: string;
  items: ConfirmationItem[];
  subtotalCents: number;
  shippingAddress: string[];
};

/**
 * Escapes a value for interpolation into HTML.
 *
 * Product names and addresses are user- and admin-supplied and end up inside
 * an email body, so every interpolation goes through here. Single quotes are
 * escaped too: the output is only ever used in element content here, but
 * escaping them keeps it safe if a value later lands in an attribute.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function lineTotalCents(item: ConfirmationItem): number {
  return item.unitPriceCents * item.quantity;
}

/** The greeting uses only the first name, and degrades to no name at all. */
export function greeting(recipientName: string | null): string {
  const first = recipientName?.trim().split(/\s+/)[0];
  return first ? `Thanks, ${escapeHtml(first)} — ` : "Thanks — ";
}

export function buildSubject(orderNumber: string): string {
  return `Order ${orderNumber} confirmed`;
}

export function renderConfirmationHtml(input: ConfirmationInput): string {
  const rows = input.items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e8e6e1;">
            <strong style="color:#1c1b19;">${escapeHtml(item.name)}</strong><br/>
            <span style="color:#6b6862;font-size:13px;">Qty ${item.quantity} &times; ${formatCents(item.unitPriceCents)}</span>
          </td>
          <td align="right" style="padding:12px 0;border-bottom:1px solid #e8e6e1;color:#1c1b19;">
            ${formatCents(lineTotalCents(item))}
          </td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f7f6f3;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <tr><td>
        <p style="margin:0 0 4px;color:#6b6862;font-size:13px;letter-spacing:.08em;text-transform:uppercase;">Verdant Supply Co.</p>
        <h1 style="margin:0 0 8px;font-size:22px;color:#1c1b19;">Order confirmed</h1>
        <p style="margin:0 0 24px;color:#4a4842;font-size:15px;line-height:1.5;">
          ${greeting(input.recipientName)}we&rsquo;ve got your order.
          Your order number is <strong>${escapeHtml(input.orderNumber)}</strong>.
        </p>
        <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;">
          ${rows}
          <tr>
            <td style="padding:16px 0 0;color:#1c1b19;font-weight:600;">Total</td>
            <td align="right" style="padding:16px 0 0;color:#1c1b19;font-weight:600;">${formatCents(input.subtotalCents)}</td>
          </tr>
        </table>
        <p style="margin:28px 0 6px;color:#6b6862;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">Shipping to</p>
        <p style="margin:0;color:#4a4842;font-size:14px;line-height:1.6;">
          ${input.shippingAddress.map(escapeHtml).join("<br/>")}
        </p>
        <p style="margin:28px 0 0;color:#8a8780;font-size:12px;line-height:1.5;">
          This is a demo store built for an HNG assessment. No payment was taken and nothing will ship.
        </p>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** The exact JSON body Brevo's transactional endpoint expects. */
export function buildBrevoPayload(
  input: ConfirmationInput,
  sender: { email: string; name: string },
) {
  return {
    sender,
    to: [{ email: input.to, name: input.recipientName ?? undefined }],
    subject: buildSubject(input.orderNumber),
    htmlContent: renderConfirmationHtml(input),
  };
}
