import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ConfirmationInput } from "../lib/email-template";
import { BREVO_ENDPOINT, sendOrderConfirmation } from "../lib/email";

const INPUT: ConfirmationInput = {
  to: "buyer@example.com",
  recipientName: "Ada Lovelace",
  orderNumber: "VS-7K2M4Q",
  items: [{ name: "Monstera Deliciosa", quantity: 1, unitPriceCents: 4800 }],
  subtotalCents: 4800,
  shippingAddress: ["Ada Lovelace", "12 Analytical Way"],
};

const ENV = {
  BREVO_API_KEY: "test-key",
  BREVO_SENDER_EMAIL: "shop@example.com",
  BREVO_SENDER_NAME: "Verdant Supply Co.",
};

type Call = { url: string; init: RequestInit };

/** A fetch stub that records calls and returns a canned response. */
function stubFetch(
  response: { status: number; body?: string },
  calls: Call[] = [],
) {
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      text: async () => response.body ?? "",
    } as Response;
  }) as unknown as typeof fetch;

  return { impl, calls };
}

describe("sendOrderConfirmation", () => {
  it("returns ok on a 201", async () => {
    const { impl } = stubFetch({ status: 201, body: '{"messageId":"x"}' });
    const result = await sendOrderConfirmation(INPUT, {
      fetchImpl: impl,
      env: ENV,
    });
    assert.deepEqual(result, { ok: true });
  });

  it("posts to Brevo's transactional endpoint", async () => {
    const { impl, calls } = stubFetch({ status: 201 });
    await sendOrderConfirmation(INPUT, { fetchImpl: impl, env: ENV });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, BREVO_ENDPOINT);
    assert.equal(calls[0].init.method, "POST");
  });

  it("sends the api key in the api-key header, not Authorization", async () => {
    const { impl, calls } = stubFetch({ status: 201 });
    await sendOrderConfirmation(INPUT, { fetchImpl: impl, env: ENV });

    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers["api-key"], "test-key");
    assert.equal(headers["content-type"], "application/json");
    assert.equal(headers.Authorization, undefined);
  });

  it("sends the sender and recipient in the body", async () => {
    const { impl, calls } = stubFetch({ status: 201 });
    await sendOrderConfirmation(INPUT, { fetchImpl: impl, env: ENV });

    const body = JSON.parse(String(calls[0].init.body));
    assert.equal(body.sender.email, "shop@example.com");
    assert.equal(body.sender.name, "Verdant Supply Co.");
    assert.equal(body.to[0].email, "buyer@example.com");
    assert.equal(body.subject, "Order VS-7K2M4Q confirmed");
    assert.ok(body.htmlContent.includes("VS-7K2M4Q"));
  });

  it("falls back to a default sender name", async () => {
    const { impl, calls } = stubFetch({ status: 201 });
    await sendOrderConfirmation(INPUT, {
      fetchImpl: impl,
      env: { ...ENV, BREVO_SENDER_NAME: undefined },
    });

    const body = JSON.parse(String(calls[0].init.body));
    assert.equal(body.sender.name, "Verdant Supply Co.");
  });

  it("fails without an API key, and does not call fetch", async () => {
    const { impl, calls } = stubFetch({ status: 201 });
    const result = await sendOrderConfirmation(INPUT, {
      fetchImpl: impl,
      env: { ...ENV, BREVO_API_KEY: undefined },
    });

    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /BREVO_API_KEY/);
    assert.equal(calls.length, 0);
  });

  it("fails without a sender address", async () => {
    const { impl } = stubFetch({ status: 201 });
    const result = await sendOrderConfirmation(INPUT, {
      fetchImpl: impl,
      env: { ...ENV, BREVO_SENDER_EMAIL: undefined },
    });

    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /BREVO_SENDER_EMAIL/);
  });

  it("reports the status and body on a 401, without throwing", async () => {
    const { impl } = stubFetch({ status: 401, body: '{"message":"bad key"}' });
    const result = await sendOrderConfirmation(INPUT, {
      fetchImpl: impl,
      env: ENV,
    });

    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /401/);
    assert.match(result.error ?? "", /bad key/);
  });

  it("reports a 400 from an unverified sender", async () => {
    const { impl } = stubFetch({
      status: 400,
      body: '{"code":"invalid_parameter","message":"sender not valid"}',
    });
    const result = await sendOrderConfirmation(INPUT, {
      fetchImpl: impl,
      env: ENV,
    });

    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /sender not valid/);
  });

  it("swallows a network error rather than throwing", async () => {
    const exploding = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    const result = await sendOrderConfirmation(INPUT, {
      fetchImpl: exploding,
      env: ENV,
    });

    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /fetch failed/);
  });

  it("still fails cleanly when the error body cannot be read", async () => {
    const impl = (async () =>
      ({
        ok: false,
        status: 500,
        text: async () => {
          throw new Error("stream already consumed");
        },
      }) as unknown as Response) as unknown as typeof fetch;

    const result = await sendOrderConfirmation(INPUT, {
      fetchImpl: impl,
      env: ENV,
    });

    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /500/);
  });

  it("never throws, whatever the provider does", async () => {
    const cases: Array<() => typeof fetch> = [
      () => stubFetch({ status: 500 }).impl,
      () =>
        (async () => {
          throw new Error("boom");
        }) as unknown as typeof fetch,
      () => (async () => null) as unknown as typeof fetch,
    ];

    for (const makeImpl of cases) {
      await assert.doesNotReject(
        sendOrderConfirmation(INPUT, { fetchImpl: makeImpl(), env: ENV }),
      );
    }
  });
});
