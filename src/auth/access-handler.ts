/**
 * Cloudflare Access OAuth authorization handler.
 * Adapted from cloudflare/ai demos/remote-mcp-cf-access.
 *
 * Handles the OAuth authorization flow using Cloudflare Access
 * as the upstream identity provider. Users authenticate via CF Access
 * (email OTP or configured IdP), and the handler verifies the JWT
 * before completing the OAuth authorization.
 *
 * Routes:
 *   GET  /authorize  - Show approval dialog or auto-approve
 *   POST /authorize  - Validate CSRF, redirect to CF Access
 *   GET  /callback   - Exchange code, verify JWT, complete auth
 */

import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import {
  addApprovedClient,
  createOAuthState,
  fetchUpstreamAuthToken,
  generateCSRFProtection,
  getUpstreamAuthorizeUrl,
  isClientApproved,
  OAuthError,
  type Props,
  renderApprovalDialog,
  validateCSRFToken,
  validateOAuthState,
} from "./workers-oauth-utils.js";

// ============================================================================
// Types
// ============================================================================

export interface AccessHandlerEnv {
  OAUTH_PROVIDER: OAuthHelpers;
  OAUTH_KV: KVNamespace;
  ACCESS_CLIENT_ID: string;
  ACCESS_CLIENT_SECRET: string;
  ACCESS_TOKEN_URL: string;
  ACCESS_AUTHORIZATION_URL: string;
  ACCESS_JWKS_URL: string;
  COOKIE_ENCRYPTION_KEY: string;
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handleAccessRequest(
  request: Request,
  env: AccessHandlerEnv,
  _ctx: ExecutionContext,
): Promise<Response> {
  const { pathname, searchParams } = new URL(request.url);

  if (request.method === "GET" && pathname === "/authorize") {
    const oauthReqInfo = await env.OAUTH_PROVIDER.parseAuthRequest(request);
    const { clientId } = oauthReqInfo;
    if (!clientId) {
      return new Response("Invalid request", { status: 400 });
    }

    // Auto-approve if client is already approved
    if (await isClientApproved(request, clientId, env.COOKIE_ENCRYPTION_KEY)) {
      const { stateToken } = await createOAuthState(oauthReqInfo, env.OAUTH_KV);
      return redirectToAccess(request, env, stateToken);
    }

    // Show approval dialog with CSRF protection
    const { token: csrfToken, setCookie } = generateCSRFProtection();

    return renderApprovalDialog(request, {
      client: await env.OAUTH_PROVIDER.lookupClient(clientId),
      csrfToken,
      server: {
        description: "MCP Server — only authorized users may connect.",
        name: "MCP Server",
      },
      setCookie,
      state: { oauthReqInfo },
    });
  }

  if (request.method === "POST" && pathname === "/authorize") {
    try {
      const formData = await request.formData();
      validateCSRFToken(formData, request);

      const encodedState = formData.get("state");
      if (!encodedState || typeof encodedState !== "string") {
        return new Response("Missing state in form data", { status: 400 });
      }

      let state: { oauthReqInfo?: AuthRequest };
      try {
        state = JSON.parse(atob(encodedState));
      } catch {
        return new Response("Invalid state data", { status: 400 });
      }

      if (!state.oauthReqInfo || !state.oauthReqInfo.clientId) {
        return new Response("Invalid request", { status: 400 });
      }

      const approvedClientCookie = await addApprovedClient(
        request,
        state.oauthReqInfo.clientId,
        env.COOKIE_ENCRYPTION_KEY,
      );

      const { stateToken } = await createOAuthState(state.oauthReqInfo, env.OAUTH_KV);

      return redirectToAccess(request, env, stateToken, {
        "Set-Cookie": approvedClientCookie,
      });
    } catch (error: any) {
      console.error("POST /authorize error:", error);
      if (error instanceof OAuthError) {
        return error.toResponse();
      }
      return new Response(`Internal server error: ${error.message}`, {
        status: 500,
      });
    }
  }

  if (request.method === "GET" && pathname === "/callback") {
    try {
      let oauthReqInfo: AuthRequest;

      try {
        const result = await validateOAuthState(request, env.OAUTH_KV);
        oauthReqInfo = result.oauthReqInfo;
      } catch (error: any) {
        if (error instanceof OAuthError) {
          return error.toResponse();
        }
        return new Response("Internal server error", { status: 500 });
      }

      if (!oauthReqInfo.clientId) {
        return new Response("Invalid OAuth request data", { status: 400 });
      }

      // Exchange code for access token
      const [accessToken, idToken, errResponse] = await fetchUpstreamAuthToken({
        client_id: env.ACCESS_CLIENT_ID,
        client_secret: env.ACCESS_CLIENT_SECRET,
        code: searchParams.get("code") ?? undefined,
        redirect_uri: new URL("/callback", request.url).href,
        upstream_url: env.ACCESS_TOKEN_URL,
      });
      if (errResponse) {
        return errResponse;
      }

      // Verify the ID token JWT
      const idTokenClaims = await verifyToken(env, idToken);
      const user = {
        email: idTokenClaims.email,
        name: idTokenClaims.name,
        sub: idTokenClaims.sub,
      };

      // Complete authorization — token flows back to the MCP client
      const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
        metadata: {
          label: user.name,
        },
        props: {
          accessToken,
          email: user.email,
          login: user.sub,
          name: user.name,
        } as Props,
        request: oauthReqInfo,
        scope: oauthReqInfo.scope,
        userId: user.sub,
      });

      return Response.redirect(redirectTo, 302);
    } catch (error: any) {
      console.error("GET /callback error:", error?.message ?? error, error?.stack);
      return new Response(`OAuth callback error: ${error?.message ?? "unknown error"}`, {
        status: 500,
      });
    }
  }

  return new Response("Not Found", { status: 404 });
}

// ============================================================================
// Helpers
// ============================================================================

function redirectToAccess(
  request: Request,
  env: AccessHandlerEnv,
  stateToken: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(null, {
    headers: {
      ...headers,
      location: getUpstreamAuthorizeUrl({
        client_id: env.ACCESS_CLIENT_ID,
        redirect_uri: new URL("/callback", request.url).href,
        scope: "openid email profile",
        state: stateToken,
        upstream_url: env.ACCESS_AUTHORIZATION_URL,
      }),
    },
    status: 302,
  });
}

async function fetchAccessPublicKey(env: AccessHandlerEnv, kid: string) {
  if (!env.ACCESS_JWKS_URL) {
    throw new Error("ACCESS_JWKS_URL not provided");
  }

  const resp = await fetch(env.ACCESS_JWKS_URL);
  const keys = (await resp.json()) as {
    keys: (JsonWebKey & { kid: string })[];
  };
  const jwk = keys.keys.filter((key) => key.kid === kid)[0];
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
    false,
    ["verify"],
  );
}

function base64UrlDecode(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlDecodeString(input: string): string {
  return new TextDecoder().decode(base64UrlDecode(input));
}

function parseJWT(token: string) {
  const tokenParts = token.split(".");
  if (tokenParts.length !== 3) {
    throw new Error("token must have 3 parts");
  }

  return {
    data: `${tokenParts[0]}.${tokenParts[1]}`,
    header: JSON.parse(base64UrlDecodeString(tokenParts[0])),
    payload: JSON.parse(base64UrlDecodeString(tokenParts[1])),
    signature: tokenParts[2],
  };
}

async function verifyToken(env: AccessHandlerEnv, token: string) {
  const jwt = parseJWT(token);
  const key = await fetchAccessPublicKey(env, jwt.header.kid);

  const sigBytes = base64UrlDecode(jwt.signature);
  const dataBytes = new TextEncoder().encode(jwt.data);

  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    sigBytes.buffer as ArrayBuffer,
    dataBytes.buffer as ArrayBuffer,
  );

  if (!verified) {
    throw new Error("failed to verify token");
  }

  const claims = jwt.payload;
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp < now) {
    throw new Error("expired token");
  }

  return claims;
}
