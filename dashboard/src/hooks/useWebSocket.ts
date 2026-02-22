import { useEffect, useRef, useState, useCallback } from "react";

interface WsEvent {
  type: string;
  data: unknown;
}

export function useWebSocket(guildId: string | undefined) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);

  const connect = useCallback(() => {
    if (!guildId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/v1/ws`);

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "subscribe", guild_id: guildId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsEvent;
        setLastEvent(data);
      } catch {
        // ignore invalid messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [guildId]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { connected, lastEvent };
}
