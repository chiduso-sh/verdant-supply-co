import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBrevoPayload,
  buildSubject,
  escapeHtml,
  greeting,
  lineTotalCents,
  renderConfirmationHtml,
  type ConfirmationInput,
} from "../lib/email-template";

const INPUT: ConfirmationInput = {
  to: "buyer@example.com",
  recipientName: "Ada Lovelace",
  orderNumber: "VS-7K2M4Q",
  items: [
    { name: "Monstera Deliciosa", quantity: 2, unitPriceCents: 4800 },
    { name: "Brass Plant Mister", quantity: 1, unitPriceCents: 3400 },
  ],
  subtotalCents: 13_000,
  shippingAddress: [
    "Ada Lovelace",
    "12 Analytical Way",
    "London, Greater London NW1 4RX",
    "United Kingdom",
  ],
};

describe("escapeHtml", () => {
  it("escapes all five dangerous characters", () => {
    assert.equal(
      escapeHtml(`&<>"'`),
      "&amp;&lt;&gt;&quot;&#39;",
    );
  });

  it("escapes ampersands before other entities, so output is not double-escaped", () => {
    assert.equal(escapeHtml("a & b"), "a &amp; b");
    assert.equal(escapeHtml("<"), "&lt;");
    // If & were escaped last, "<" would become "&amp;lt;".
    assert.ok(!escapeHtml("<").includes("&amp;"));
  });

  it("neutralizes a script tag", () => {
    assert.equal(
      escapeHtml('<script>alert("xss")</script>'),
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
  });

  it("leaves ordinary text untouched", () => {
    assert.equal(escapeHtml("Monstera Deliciosa"), "Monstera Deliciosa");
  });

  it("handles an empty string", () => {
    assert.equal(escapeHtml(""), "");
  });
});

describe("lineTotalCents", () => {
  it("multiplies unit price by quantity", () => {
    assert.equal(
      lineTotalCents({ name: "x", quantity: 3, unitPriceCents: 1999 }),
      5997,
    );
  });

  it("is zero at quantity zero", () => {
    assert.equal(
      lineTotalCents({ name: "x", quantity: 0, unitPriceCents: 1999 }),
      0,
    );
  });
});

describe("greeting", () => {
  it("uses the first name only", () => {
    assert.equal(greeting("Ada Lovelace"), "Thanks, Ada — ");
  });

  it("falls back to no name for null", () => {
    assert.equal(greeting(null), "Thanks — ");
  });

  it("falls back to no name for whitespace", () => {
    assert.equal(greeting("   "), "Thanks — ");
  });

  it("handles a single-word name", () => {
    assert.equal(greeting("Ada"), "Thanks, Ada — ");
  });

  it("escapes a hostile name", () => {
    assert.ok(!greeting("<script>").includes("<script>"));
    assert.ok(greeting("<script>").includes("&lt;script&gt;"));
  });
});

describe("buildSubject", () => {
  it("includes the order number", () => {
    assert.equal(buildSubject("VS-7K2M4Q"), "Order VS-7K2M4Q confirmed");
  });
});

describe("renderConfirmationHtml", () => {
  const html = renderConfirmationHtml(INPUT);

  it("is a complete HTML document", () => {
    assert.ok(html.startsWith("<!doctype html>"));
    assert.ok(html.trimEnd().endsWith("</html>"));
  });

  it("shows the order number", () => {
    assert.ok(html.includes("VS-7K2M4Q"));
  });

  it("lists every item by name", () => {
    assert.ok(html.includes("Monstera Deliciosa"));
    assert.ok(html.includes("Brass Plant Mister"));
  });

  it("shows per-line totals, not just unit prices", () => {
    assert.ok(html.includes("$96.00"), "2 × $48.00 should render as $96.00");
    assert.ok(html.includes("$34.00"));
  });

  it("shows unit price and quantity", () => {
    assert.ok(html.includes("Qty 2"));
    assert.ok(html.includes("$48.00"));
  });

  it("shows the order total", () => {
    assert.ok(html.includes("$130.00"));
  });

  it("renders every shipping line", () => {
    for (const line of INPUT.shippingAddress) {
      assert.ok(html.includes(line), `missing address line: ${line}`);
    }
  });

  it("states that no payment was taken", () => {
    assert.ok(html.toLowerCase().includes("no payment"));
  });

  it("escapes a malicious product name", () => {
    const hostile = renderConfirmationHtml({
      ...INPUT,
      items: [
        {
          name: '<img src=x onerror="alert(1)">',
          quantity: 1,
          unitPriceCents: 100,
        },
      ],
    });
    assert.ok(!hostile.includes("<img src=x"));
    assert.ok(hostile.includes("&lt;img src=x"));
  });

  it("escapes a malicious address line", () => {
    const hostile = renderConfirmationHtml({
      ...INPUT,
      shippingAddress: ["<b>bold</b>"],
    });
    assert.ok(!hostile.includes("<b>bold</b>"));
    assert.ok(hostile.includes("&lt;b&gt;bold&lt;/b&gt;"));
  });

  it("renders an order with a single item", () => {
    const single = renderConfirmationHtml({
      ...INPUT,
      items: [INPUT.items[0]],
      subtotalCents: 9600,
    });
    assert.ok(single.includes("$96.00"));
  });
});

describe("buildBrevoPayload", () => {
  const payload = buildBrevoPayload(INPUT, {
    email: "shop@example.com",
    name: "Verdant Supply Co.",
  });

  it("puts the verified sender in `sender`", () => {
    assert.deepEqual(payload.sender, {
      email: "shop@example.com",
      name: "Verdant Supply Co.",
    });
  });

  it("addresses the recipient from the input", () => {
    assert.deepEqual(payload.to, [
      { email: "buyer@example.com", name: "Ada Lovelace" },
    ]);
  });

  it("omits the recipient name when there isn't one", () => {
    const anonymous = buildBrevoPayload(
      { ...INPUT, recipientName: null },
      { email: "shop@example.com", name: "Shop" },
    );
    assert.equal(anonymous.to[0].name, undefined);
  });

  it("sets the subject and body", () => {
    assert.equal(payload.subject, "Order VS-7K2M4Q confirmed");
    assert.ok(payload.htmlContent.includes("Order confirmed"));
  });

  it("serializes to JSON cleanly", () => {
    assert.doesNotThrow(() => JSON.stringify(payload));
  });
});
