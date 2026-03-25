import { randomBytes, randomUUID } from "node:crypto";
import type { Response } from "express";
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type {
  OAuthClientInformationFull,
  OAuthTokens,
  OAuthTokenRevocationRequest,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { renderLoginPage } from "./login.js";

// ─── In-memory stores ───

const clients = new Map<string, OAuthClientInformationFull>();

interface AuthCode {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  state?: string;
}
const authCodes = new Map<string, AuthCode>();

interface StoredToken {
  clientId: string;
  expiresAt: number; // epoch seconds
  type: "access" | "refresh";
}
const tokens = new Map<string, StoredToken>();

// ─── Helpers ───

const TOKEN_TTL = 3600; // 1 hour
const REFRESH_TTL = 30 * 24 * 3600; // 30 days

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function getPassword(): string {
  const pw = process.env.MCP_AUTH_PASSWORD;
  if (!pw) {
    throw new Error(
      "MCP_AUTH_PASSWORD environment variable is required for OAuth authentication"
    );
  }
  return pw;
}

// ─── Clients store ───

const clientsStore: OAuthRegisteredClientsStore = {
  getClient(clientId: string) {
    return clients.get(clientId);
  },

  registerClient(
    client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">
  ): OAuthClientInformationFull {
    const fullClient: OAuthClientInformationFull = {
      ...client,
      client_id: randomUUID(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    clients.set(fullClient.client_id, fullClient);
    return fullClient;
  },
};

// ─── Provider ───

export const oauthProvider: OAuthServerProvider = {
  get clientsStore() {
    return clientsStore;
  },

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    const html = renderLoginPage({
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      state: params.state,
      codeChallenge: params.codeChallenge,
    });
    res.type("html").send(html);
  },

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<string> {
    const entry = authCodes.get(authorizationCode);
    if (!entry) {
      throw new Error("Invalid authorization code");
    }
    return entry.codeChallenge;
  },

  async exchangeAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<OAuthTokens> {
    const entry = authCodes.get(authorizationCode);
    if (!entry) {
      throw new Error("Invalid authorization code");
    }
    authCodes.delete(authorizationCode);

    const accessToken = generateToken();
    const refreshToken = generateToken();
    const now = Math.floor(Date.now() / 1000);

    tokens.set(accessToken, {
      clientId: entry.clientId,
      expiresAt: now + TOKEN_TTL,
      type: "access",
    });
    tokens.set(refreshToken, {
      clientId: entry.clientId,
      expiresAt: now + REFRESH_TTL,
      type: "refresh",
    });

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: TOKEN_TTL,
      refresh_token: refreshToken,
    };
  },

  async exchangeRefreshToken(
    _client: OAuthClientInformationFull,
    refreshToken: string
  ): Promise<OAuthTokens> {
    const entry = tokens.get(refreshToken);
    if (!entry || entry.type !== "refresh") {
      throw new Error("Invalid refresh token");
    }

    const now = Math.floor(Date.now() / 1000);
    if (entry.expiresAt < now) {
      tokens.delete(refreshToken);
      throw new Error("Refresh token expired");
    }

    const accessToken = generateToken();
    tokens.set(accessToken, {
      clientId: entry.clientId,
      expiresAt: now + TOKEN_TTL,
      type: "access",
    });

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: TOKEN_TTL,
      refresh_token: refreshToken,
    };
  },

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const entry = tokens.get(token);
    if (!entry || entry.type !== "access") {
      throw new Error("Invalid access token");
    }

    const now = Math.floor(Date.now() / 1000);
    if (entry.expiresAt < now) {
      tokens.delete(token);
      throw new Error("Access token expired");
    }

    return {
      token,
      clientId: entry.clientId,
      scopes: [],
      expiresAt: entry.expiresAt,
    };
  },

  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest
  ): Promise<void> {
    tokens.delete(request.token);
  },
};

// ─── Authorize callback (form POST handler) ───

/**
 * Handles the POST from the login form.
 * Returns a redirect URL on success, or null with error sent on failure.
 */
export function handleAuthorizeCallback(
  password: string,
  clientId: string,
  redirectUri: string,
  state: string,
  codeChallenge: string,
  res: Response
): void {
  if (password !== getPassword()) {
    const html = renderLoginPage({
      clientId,
      redirectUri,
      state,
      codeChallenge,
      error: "Senha incorreta. Tente novamente.",
    });
    res.type("html").send(html);
    return;
  }

  const code = randomBytes(16).toString("hex");
  authCodes.set(code, {
    clientId,
    codeChallenge,
    redirectUri,
    state,
  });

  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) {
    url.searchParams.set("state", state);
  }
  res.redirect(302, url.toString());
}
