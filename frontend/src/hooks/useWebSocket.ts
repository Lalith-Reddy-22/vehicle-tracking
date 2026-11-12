/**
 * useWebSocket: manages a WebSocket connection with automatic reconnection
 * using exponential backoff. Used to receive real-time geofence alerts.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { WSAlert } from '../types';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws/alerts';

const MIN_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

export function useWebSocket(onAlert: (alert: WSAlert) => void) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(MIN_RECONNECT_MS);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);

  const connect = useCallback(() => {
    if (unmounted.current) return;
    setStatus('connecting');

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmounted.current) { ws.close(); return; }
      setStatus('connected');
      reconnectDelay.current = MIN_RECONNECT_MS; // reset backoff on success
    };

    ws.onmessage = (event) => {
      try {
        const alert: WSAlert = JSON.parse(event.data);
        onAlert(alert);
      } catch {
        // Silently ignore malformed messages.
      }
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      setStatus('disconnected');
      wsRef.current = null;

      // Exponential backoff reconnect.
      const delay = reconnectDelay.current;
      reconnectDelay.current = Math.min(delay * 2, MAX_RECONNECT_MS);
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close(); // triggers onclose which schedules reconnect
    };
  }, [onAlert]);

  useEffect(() => {
    unmounted.current = false;
    connect();

    return () => {
      unmounted.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return status;
}
