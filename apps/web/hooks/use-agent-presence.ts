"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AgentPresence, PresenceStatus } from "@velobot/shared";

const HEARTBEAT_INTERVAL_MS = 20_000;

/** Sends a periodic heartbeat for the current user and streams the whole org's presence roster. */
export function useAgentPresence(orgId: string | null) {
  const [roster, setRoster] = useState<Record<string, PresenceStatus>>({});
  const statusRef = useRef<PresenceStatus>("online");

  const sendHeartbeat = useCallback(
    (status: PresenceStatus) => {
      if (!orgId) return;
      statusRef.current = status;
      fetch("/api/presence/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, status }),
        keepalive: true,
      }).catch(() => {});
    },
    [orgId]
  );

  useEffect(() => {
    if (!orgId) return;
    sendHeartbeat("online");
    const interval = setInterval(() => sendHeartbeat(statusRef.current), HEARTBEAT_INTERVAL_MS);

    const onVisibility = () => sendHeartbeat(document.hidden ? "away" : "online");
    document.addEventListener("visibilitychange", onVisibility);

    const onUnload = () => sendHeartbeat("offline");
    window.addEventListener("beforeunload", onUnload);

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`agent-presence:${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_presence", filter: `org_id=eq.${orgId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as AgentPresence | undefined;
          if (!row) return;
          setRoster((prev) => ({ ...prev, [row.user_id]: row.status }));
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
      sendHeartbeat("offline");
      supabase.removeChannel(channel);
    };
  }, [orgId, sendHeartbeat]);

  return { roster, setStatus: sendHeartbeat };
}
