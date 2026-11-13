/**
 * useWebSocket: manages a WebSocket connection with automatic reconnection
 * using exponential backoff. Used to receive real-time geofence alerts.
 */
import { useEffect, useRef, useState } from 'react';
import type { WSAlert, ConnectionStatus } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws/alerts';

const MIN_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

export function useWebSocket(onAlert: (alert: WSAlert) => void): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const onAlertRef = useRef(onAlert);

  useEffect(() => {
    onAlertRef.current = onAlert;
  }, [onAlert]);

  useEffect(() => {
    let unmounted = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = MIN_RECONNECT_MS;

    function connect() {
      if (unmounted) return;
      setStatus('connecting');

      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        if (unmounted) {
          ws?.close();
          return;
        }
        setStatus('connected');
        reconnectDelay = MIN_RECONNECT_MS;
      };

      ws.onmessage = event => {
        try {
          const alert: WSAlert = JSON.parse(event.data);
          onAlertRef.current(alert);
        } catch {
          // Silently ignore malformed messages.
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        setStatus('disconnected');
        ws = null;

        const delay = reconnectDelay;
        reconnectDelay = Math.min(delay * 2, MAX_RECONNECT_MS);
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  return status;
}
