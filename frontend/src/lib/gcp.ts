import { GCP_FUNCTION_URL } from './config';

const MAX_RETRIES = 2;
const RETRY_DELAYS = [500, 1500]; // ms

/**
 * Makes a proxied request to the GCP Cloud Function backend.
 * Retries on 429 (rate limited) and 5xx errors with backoff.
 */
export async function gcpFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  if (!GCP_FUNCTION_URL) {
    throw new Error('GCP_FUNCTION_URL is not configured');
  }

  const url = `${GCP_FUNCTION_URL}${path}`;
  const fetchOpts: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, fetchOpts);

    if (res.status === 429 || (res.status >= 500 && attempt < MAX_RETRIES)) {
      const delay = RETRY_DELAYS[attempt] ?? 2000;
      console.warn(
        `GCP request ${path} returned ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
      );
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    return res;
  }

  // Final attempt (shouldn't reach here, but just in case)
  return fetch(url, fetchOpts);
}

/**
 * Safely parse a GCP response as JSON.
 * If the response is not valid JSON (e.g. "Rate exceeded." plain text from Cloud Run),
 * returns a structured error object instead of throwing.
 */
export async function gcpJsonResponse(
  res: Response
): Promise<{ data: unknown; status: number }> {
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    return { data, status: res.status };
  } catch {
    // Non-JSON response (rate limit, 502, etc.)
    return {
      data: { error: text.trim() || `HTTP ${res.status}` },
      status: res.status >= 400 ? res.status : 502,
    };
  }
}
