import {
  buildBrevoPayload,
  type ConfirmationInput,
} from "./email-template";

export type { ConfirmationInput, ConfirmationItem } from "./email-template";

export const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export type SendResult = { ok: boolean; error?: string };

type SendDeps = {
  fetchImpl?: typeof fetch;
  env?: {
    BREVO_API_KEY?: string;
    BREVO_SENDER_EMAIL?: string;
    BREVO_SENDER_NAME?: string;
  };
};

/**
 * Sends the order confirmation through Brevo's HTTP API.
 *
 * Brevo is used rather than Resend or Mailgun because it verifies a *sender
 * address* instead of a domain, so this can mail any recipient without owning
 * a domain. It is an HTTP API rather than SMTP, which matters on serverless
 * where a connection cannot be kept warm between invocations.
 *
 * Never throws: a dead mail provider must not cost the customer their order.
 * `fetchImpl` and `env` are injectable so this is testable without a network.
 */
export async function sendOrderConfirmation(
  input: ConfirmationInput,
  deps: SendDeps = {},
): Promise<SendResult> {
  const env = deps.env ?? process.env;
  const fetchImpl = deps.fetchImpl ?? fetch;

  const apiKey = env.BREVO_API_KEY;
  const senderEmail = env.BREVO_SENDER_EMAIL;

  if (!apiKey || !senderEmail) {
    return { ok: false, error: "BREVO_API_KEY or BREVO_SENDER_EMAIL missing" };
  }

  const payload = buildBrevoPayload(input, {
    email: senderEmail,
    name: env.BREVO_SENDER_NAME ?? "Verdant Supply Co.",
  });

  try {
    const response = await fetchImpl(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "<unreadable body>");
      return { ok: false, error: `Brevo returned ${response.status}: ${body}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}
