// Cloudflare Worker entry point.
// Static files (from `dist/`, built by `npm run build`) are served via the
// ASSETS binding. Requests to /api/cleanup are handled here instead, since
// this project deploys as a Worker rather than as Cloudflare Pages.
//
// Setup (do this once you're ready to enable "Clean up with AI"):
//   1. Get an API key from https://console.anthropic.com/settings/keys
//   2. In the Cloudflare dashboard: Workers & Pages -> your project ->
//      Settings -> Variables and Secrets -> add a SECRET named
//      ANTHROPIC_API_KEY with that value.
//   3. Redeploy. The key stays server-side and is never sent to the browser.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/cleanup" && request.method === "POST") {
      return handleCleanup(request, env);
    }

    // Everything else: serve the built static site.
    return env.ASSETS.fetch(request);
  },
};

async function handleCleanup(request, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured yet" }),
      { status: 501, headers: { "Content-Type": "application/json" } }
    );
  }

  let fields;
  try {
    fields = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const hasContent = Object.values(fields || {}).some(
    (v) => typeof v === "string" && v.trim()
  );
  if (!hasContent) {
    return new Response(JSON.stringify({ error: "No content to clean" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system:
          "You clean up Indonesian voice-transcribed shift reports from factory workers. For each field, rewrite it into a short, clear sentence in Indonesian. Keep the same language (Indonesian) and the same meaning. Remove filler words, false starts, and repeated phrases. Never add information that wasn't said. If a field is empty, leave it as an empty string. Respond ONLY with valid JSON using the exact keys workDone, problem, solution, followUp — no markdown, no explanation.",
        messages: [{ role: "user", content: JSON.stringify(fields) }],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return new Response(JSON.stringify({ error: "Upstream error", detail }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await upstream.json();
    const text = (data.content || []).map((b) => b.text || "").join("");
    const cleaned = JSON.parse(text.replace(/```json|```/g, "").trim());

    return new Response(JSON.stringify(cleaned), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Cleanup failed", detail: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
