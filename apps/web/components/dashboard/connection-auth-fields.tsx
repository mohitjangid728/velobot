"use client";

import type { ConnectionAuthType, ConnectionAuthConfig } from "@velobot/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const AUTH_TYPE_LABELS: Record<ConnectionAuthType, string> = {
  custom_headers: "Custom headers",
  api_key: "API Key",
  bearer_token: "Bearer Token",
  basic_auth: "Basic Auth",
  jwt: "JWT",
  oauth2: "OAuth 2.0",
  oauth1: "OAuth 1.0a",
};

const AUTH_TYPES: ConnectionAuthType[] = ["custom_headers", "api_key", "bearer_token", "basic_auth", "jwt", "oauth2", "oauth1"];

export function defaultAuthConfig(type: ConnectionAuthType): ConnectionAuthConfig {
  switch (type) {
    case "api_key":
      return { type, header_name: "", api_key: "", location: "header" };
    case "bearer_token":
      return { type, token: "" };
    case "basic_auth":
      return { type, username: "", password: "" };
    case "jwt":
      return { type, token: "" };
    case "oauth2":
      return { type, grant_type: "client_credentials", token_url: "", client_id: "", client_secret: "", scope: "" };
    case "oauth1":
      return { type, consumer_key: "", consumer_secret: "", access_token: "", access_token_secret: "" };
    default:
      return { type: "custom_headers" };
  }
}

/** Base64url-decodes a JWT's payload segment client-side to read its `exp` claim — purely informational, no server round-trip. */
function decodeJwtExpiry(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof json.exp !== "number") return null;
    return new Date(json.exp * 1000).toLocaleString();
  } catch {
    return null;
  }
}

export function ConnectionAuthFields({
  authType,
  authConfig,
  onAuthTypeChange,
  onAuthConfigChange,
}: {
  authType: ConnectionAuthType;
  authConfig: ConnectionAuthConfig;
  onAuthTypeChange: (type: ConnectionAuthType) => void;
  onAuthConfigChange: (config: ConnectionAuthConfig) => void;
}) {
  function patch(fields: Record<string, unknown>) {
    onAuthConfigChange({ ...authConfig, ...fields } as ConnectionAuthConfig);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>Authentication</Label>
        <Select
          value={authType}
          onValueChange={(v) => {
            const type = v as ConnectionAuthType;
            onAuthTypeChange(type);
            onAuthConfigChange(defaultAuthConfig(type));
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUTH_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {AUTH_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {authConfig.type === "api_key" && (
        <div className="grid grid-cols-[120px_1fr_1fr] gap-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Send in</Label>
            <Select value={authConfig.location} onValueChange={(v) => patch({ location: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="header">Header</SelectItem>
                <SelectItem value="query">Query param</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Key name</Label>
            <Input placeholder="x-api-key" value={authConfig.header_name} onChange={(e) => patch({ header_name: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Key value</Label>
            <Input type="password" value={authConfig.api_key} onChange={(e) => patch({ api_key: e.target.value })} />
          </div>
        </div>
      )}

      {authConfig.type === "bearer_token" && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Token</Label>
          <Input type="password" placeholder="sk_live_..." value={authConfig.token} onChange={(e) => patch({ token: e.target.value })} />
        </div>
      )}

      {authConfig.type === "basic_auth" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Username</Label>
            <Input value={authConfig.username} onChange={(e) => patch({ username: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Password</Label>
            <Input type="password" value={authConfig.password} onChange={(e) => patch({ password: e.target.value })} />
          </div>
        </div>
      )}

      {authConfig.type === "jwt" && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">JWT</Label>
          <Textarea rows={3} placeholder="eyJhbGciOi..." value={authConfig.token} onChange={(e) => patch({ token: e.target.value })} />
          {authConfig.token &&
            (decodeJwtExpiry(authConfig.token) ? (
              <p className="text-xs text-muted-foreground">Expires {decodeJwtExpiry(authConfig.token)}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Couldn&apos;t read an expiry claim from this token.</p>
            ))}
          <p className="text-xs text-muted-foreground">
            A static token has no standard refresh mechanism — rotate it here manually when it expires.
          </p>
        </div>
      )}

      {authConfig.type === "oauth2" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Grant type</Label>
            <Select value={authConfig.grant_type} onValueChange={(v) => patch({ grant_type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client_credentials">Client Credentials</SelectItem>
                <SelectItem value="refresh_token">Refresh Token</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Token URL</Label>
            <Input placeholder="https://auth.example.com/oauth/token" value={authConfig.token_url} onChange={(e) => patch({ token_url: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Client ID</Label>
              <Input value={authConfig.client_id} onChange={(e) => patch({ client_id: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Client secret</Label>
              <Input type="password" value={authConfig.client_secret} onChange={(e) => patch({ client_secret: e.target.value })} />
            </div>
          </div>
          {authConfig.grant_type === "client_credentials" ? (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Scope (optional)</Label>
              <Input value={authConfig.scope ?? ""} onChange={(e) => patch({ scope: e.target.value })} />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Refresh token</Label>
              <Input type="password" value={authConfig.refresh_token ?? ""} onChange={(e) => patch({ refresh_token: e.target.value })} />
            </div>
          )}
          {authConfig.expires_at && (
            <p className="text-xs text-muted-foreground">
              Access token valid until {new Date(authConfig.expires_at).toLocaleString()} — refreshed automatically after that.
            </p>
          )}
          {!authConfig.access_token && (
            <p className="text-xs text-muted-foreground">Not yet fetched — happens automatically on first use.</p>
          )}
        </div>
      )}

      {authConfig.type === "oauth1" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Consumer key</Label>
            <Input value={authConfig.consumer_key} onChange={(e) => patch({ consumer_key: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Consumer secret</Label>
            <Input type="password" value={authConfig.consumer_secret} onChange={(e) => patch({ consumer_secret: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Access token</Label>
            <Input value={authConfig.access_token} onChange={(e) => patch({ access_token: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Access token secret</Label>
            <Input type="password" value={authConfig.access_token_secret} onChange={(e) => patch({ access_token_secret: e.target.value })} />
          </div>
        </div>
      )}

      {authConfig.type === "custom_headers" && (
        <p className="text-xs text-muted-foreground">No structured auth — set everything via the headers below.</p>
      )}
    </div>
  );
}
