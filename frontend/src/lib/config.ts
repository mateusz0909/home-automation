// Credentials for dashboard authentication
// Set AUTH_USERNAME and AUTH_PASSWORD env vars in Vercel

export const AUTH_USERNAME = process.env.AUTH_USERNAME || 'admin';
export const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'curtain2026';

// Session cookie name and secret
export const SESSION_COOKIE = 'curtain_session';
export const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production-please';
