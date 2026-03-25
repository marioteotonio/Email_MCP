#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import express from "express";
import cors from "cors";
import { criarServidor } from "./server.js";
import { oauthProvider, handleAuthorizeCallback } from "./auth/provider.js";

// ============================================================
// Entry Point — Suporta stdio (Claude Code) e HTTP (claude.ai)
// ============================================================

function parseArgs(argv: string[]): { transport: string; port: number } {
  let transport = "stdio";
  let port = parseInt(process.env.PORT || "3100", 10);

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--transport" && argv[i + 1]) {
      transport = argv[i + 1];
      i++;
    } else if (argv[i] === "--port" && argv[i + 1]) {
      port = parseInt(argv[i + 1], 10);
      i++;
    }
  }

  return { transport, port };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.transport === "http") {
    await iniciarHttp(args.port);
  } else {
    await iniciarStdio();
  }
}

async function iniciarStdio() {
  const server = criarServidor();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Email MCP Server iniciado (stdio)");
}

async function iniciarHttp(port: number) {
  const app = express();

  // CORS for claude.ai
  app.use(cors());

  // Parse URL-encoded bodies (for the login form POST)
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  // Determine server URL for OAuth issuer
  const serverUrl = process.env.SERVER_URL || `http://localhost:${port}`;

  // Mount OAuth auth router (handles /.well-known/*, /authorize, /token, /register, /revoke)
  app.use(
    mcpAuthRouter({
      provider: oauthProvider,
      issuerUrl: new URL(serverUrl),
    })
  );

  // Login form POST handler
  app.post("/authorize-callback", (req, res) => {
    const { password, client_id, redirect_uri, state, code_challenge } =
      req.body;
    handleAuthorizeCallback(
      password,
      client_id,
      redirect_uri,
      state,
      code_challenge,
      res
    );
  });

  // MCP endpoint — protected by Bearer auth
  app.post(
    "/mcp",
    requireBearerAuth({ verifier: oauthProvider }),
    async (req, res) => {
      try {
        const server = criarServidor();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // stateless
        });
        res.on("close", () => {
          transport.close?.();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error("Erro ao processar request MCP:", error);
        if (!res.headersSent) {
          res.status(500).json({ error: "Erro interno do servidor" });
        }
      }
    }
  );

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "email-mcp-server", version: "1.0.0" });
  });

  app.listen(port, () => {
    console.error(`Email MCP Server iniciado (HTTP) na porta ${port}`);
    console.error(`Endpoint MCP: ${serverUrl}/mcp`);
    console.error(`Health check: ${serverUrl}/health`);
  });
}

main().catch((error) => {
  console.error("Erro fatal:", error);
  process.exit(1);
});
