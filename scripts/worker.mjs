const baseUrl = process.env.GENERATION_WORKER_URL;
const secret = process.env.GENERATION_WORKER_SECRET;
if (!baseUrl || !secret) {
  console.error("GENERATION_WORKER_URL and GENERATION_WORKER_SECRET are required.");
  process.exit(2);
}

const endpoint = new URL("/api/internal/generation-worker", baseUrl);
while (true) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: ["Bearer", secret].join(" "), "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(310_000),
    });
    if (!response.ok) {
      console.error(`Worker request failed with HTTP ${response.status}.`);
      await pause(5000);
    } else {
      const result = await response.json();
      if (!result.claimed) await pause(2000);
    }
  } catch {
    console.error("Worker endpoint unavailable; retrying.");
    await pause(5000);
  }
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
