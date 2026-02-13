// Hardcoded credentials — change these before deploying!
// Or set AUTH_USERNAME and AUTH_PASSWORD env vars in Vercel.

export const AUTH_USERNAME = process.env.AUTH_USERNAME || 'admin';
export const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'curtain2026';

// The GCP Cloud Function URL — set in Vercel env vars
export const GCP_FUNCTION_URL = process.env.GCP_FUNCTION_URL || '';

// Session cookie name and secret
export const SESSION_COOKIE = 'curtain_session';
export const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production-please';
