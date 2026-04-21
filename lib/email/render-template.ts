/**
 * Minimal, strict template renderer for transactional email bodies.
 *
 * Grammar:
 *   {{ var }}                       scalar lookup (supports dotted path: order.number)
 *   {{#items}} ... {{/items}}       section -- renders block once per array element;
 *                                   inside the block, scalar lookups resolve against
 *                                   the current element (merged over the outer scope).
 *
 * Design rules (NO FALLBACKS):
 *   - No silent "" substitution for missing keys. Missing references throw.
 *   - No type coercion. Scalars must resolve to string | number | boolean, or the
 *     author should emit them through a helper before calling render.
 *   - Section keys must resolve to an array. Non-array, non-falsy values throw.
 *   - Falsy (null / undefined / empty array) sections render nothing. That is the
 *     only "missing ok" path, and it is explicit by the template author's choice
 *     to use a section.
 *
 * HTML safety:
 *   - Scalar substitutions are HTML-escaped by default. To inject pre-rendered
 *     HTML, use a triple-brace: {{{raw_html}}}
 */

function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function lookupPath(vars: Record<string, any>, path: string): unknown {
  const parts = path.split(".")
  let cur: any = vars
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") {
      throw new Error(
        `renderTemplate: path "${path}" traverses undefined at segment "${p}"`
      )
    }
    if (!(p in cur)) {
      throw new Error(`renderTemplate: missing required variable "${path}"`)
    }
    cur = cur[p]
  }
  return cur
}

/**
 * Render a template against a variable bag. Throws on any malformed input or
 * missing required variable. Returns the final HTML string.
 */
export function renderTemplate(html: string, vars: Record<string, any>): string {
  if (typeof html !== "string" || html.length === 0) {
    throw new Error("renderTemplate: html must be a non-empty string")
  }
  if (vars == null || typeof vars !== "object") {
    throw new Error("renderTemplate: vars must be an object")
  }

  // 1. Expand sections first (outer-most, non-greedy inside each pair).
  const sectionRe = /\{\{#([a-zA-Z_][a-zA-Z0-9_]*)\}\}([\s\S]*?)\{\{\/\1\}\}/g
  const afterSections = html.replace(sectionRe, (_match, key: string, block: string) => {
    const raw = key in vars ? vars[key] : undefined
    if (raw == null) return ""
    if (!Array.isArray(raw)) {
      throw new Error(
        `renderTemplate: section "${key}" must resolve to an array (got ${typeof raw})`
      )
    }
    if (raw.length === 0) return ""
    return raw
      .map((item) => {
        const itemCtx =
          item !== null && typeof item === "object"
            ? { ...vars, ...item }
            : { ...vars }
        return renderTemplate(block, itemCtx)
      })
      .join("")
  })

  // 2. Triple-brace raw substitutions: {{{key}}} -- NOT escaped.
  const rawRe = /\{\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}\}/g
  const afterRaw = afterSections.replace(rawRe, (_m, path: string) => {
    const val = lookupPath(vars, path)
    return String(val ?? "")
  })

  // 3. Scalar substitutions: {{key}} -- HTML-escaped. Missing or undefined
  // values throw (NO FALLBACKS). Explicit null is allowed and renders "" --
  // use it when you genuinely want an empty slot.
  const scalarRe = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g
  const output = afterRaw.replace(scalarRe, (_m, path: string) => {
    const val = lookupPath(vars, path)
    if (val === undefined) {
      throw new Error(`renderTemplate: "${path}" is undefined`)
    }
    if (val !== null && typeof val === "object") {
      throw new Error(
        `renderTemplate: "${path}" resolved to object; expected scalar`
      )
    }
    return escapeHtml(val)
  })

  return output
}

/**
 * Format a USD amount for insertion into a template. Throws on non-finite input
 * to honor the NO FALLBACKS rule -- callers must pass a real number.
 */
export function formatMoney(amount: unknown): string {
  const n = typeof amount === "string" ? Number(amount) : typeof amount === "number" ? amount : NaN
  if (!Number.isFinite(n)) {
    throw new Error(`formatMoney: amount must be finite (got ${String(amount)})`)
  }
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" })
}
