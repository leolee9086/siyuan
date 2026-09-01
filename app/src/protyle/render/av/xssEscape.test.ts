import {describe, it} from "node:test";
import * as assert from "node:assert/strict";
import {escapeAttr, escapeHtml} from "../../../util/DOM/escape";

describe("GHSA XSS escapes", () => {
  it("escapeAttr sanitizes color injection", () => {
    const malicious = "1);color:red\" onmouseover=\"alert(1)\" x=\"";
    const escaped = escapeAttr(malicious);
    assert.equal(escaped, "1);color:red&quot; onmouseover=&quot;alert(1)&quot; x=&quot;");
    const style = `background-color:var(--b3-font-background${escaped})`;
    assert.equal(style.includes(malicious), false);
  });

  it("escapeHtml sanitizes display name", () => {
    const name = "<img src=x onerror=alert(1)>";
    assert.equal(escapeHtml(name), "&lt;img src=x onerror=alert(1)>");
  });

  it("select chip construction escapes color and content", () => {
    const item = {content: "<script>alert(1)</script>", color: "1\"><svg onload=alert(1)>"};
    const html = `<span class="b3-chip" style="background-color:var(--b3-font-background${escapeAttr(item.color)});color:var(--b3-font-color${escapeAttr(item.color)})">${escapeHtml(item.content)}</span>`;
    assert.equal(html.includes("<script>"), false);
    assert.ok(html.includes("&lt;script>"));
    assert.equal(html.includes("\"><svg"), false);
    assert.ok(html.includes("&quot;"));
  });

  it("group title construction escapes name and color", () => {
    const color = "2\" onmouseover=\"alert(1)";
    const content = "<b>evil</b>";
    const html = `<span class="b3-chip" style="background-color:var(--b3-font-background${escapeAttr(color)});color:var(--b3-font-color${escapeAttr(color)})">${escapeHtml(content)}</span>`;
    assert.equal(html.includes("<b>evil</b>"), false);
    assert.ok(html.includes("&lt;b>evil"));
    assert.equal(html.includes("\" onmouseover"), false);
    const fallbackName = "\"><svg onload=alert(1)>";
    const fallbackHTML = escapeHtml(fallbackName);
    assert.equal(fallbackHTML.includes("\"><svg"), false);
    assert.ok(fallbackHTML.includes("&lt;svg"));
  });

  it("textarea desc innerHTML escaped via escapeHtml", () => {
    const desc = "<svg onload=alert(1)>";
    const escaped = escapeHtml(desc);
    assert.equal(escaped, "&lt;svg onload=alert(1)>");
    const attrEscaped = escapeAttr(desc);
    assert.equal(escaped.includes("&lt;"), true);
    assert.equal(attrEscaped.includes('"'), false);
  });

  it("column width escaped via escapeAttr", () => {
    const width = "200px\";color:red;--x=\"";
    const escaped = escapeAttr(width);
    const html = `style="width: ${escaped || "200px"};"`;
    assert.equal(html.includes(width), false);
    assert.ok(html.includes("&quot;"));
  });
});
