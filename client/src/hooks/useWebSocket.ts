import { useCallback, useEffect, useRef, useState } from "react";
import { AudioData, processAudioData, isValidAudioData } from "../services/api";

interface FilterSettings {
  filterType: string;
  cutoffFreq: number;
  voiceBoost: number;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [isESP32Connected, setIsESP32Connected] = useState(false);
  const [lastData, setLastData] = useState<AudioData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const shouldReconnectRef = useRef(true);

  const connectWebSocket = useCallback(() => {
    // Evită conexiuni multiple simultane
    if (
      isConnectingRef.current ||
      (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    // If socket is already open, don't reconnect
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    // Close old socket if it exists
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        // Ignoră erori la închidere
      }
    }

    isConnectingRef.current = true;

    // Get WebSocket URL - prioritize VITE_API_URL_FASTAPI (for Genezio deployment)
    let wsUrl: string;

    if (import.meta.env.VITE_API_URL_FASTAPI) {
      // Construct WebSocket URL from FastAPI URL (for Genezio deployment)
      const apiUrl = import.meta.env.VITE_API_URL_FASTAPI;
      // Convert https:// to wss:// and http:// to ws://
      if (apiUrl.startsWith("https://")) {
        wsUrl = apiUrl.replace("https://", "wss://") + "/ws-dashboard";
      } else if (apiUrl.startsWith("http://")) {
        wsUrl = apiUrl.replace("http://", "ws://") + "/ws-dashboard";
      } else {
        // If no protocol, assume https and use wss
        wsUrl = `wss://${apiUrl}/ws-dashboard`;
      }
    } else if (import.meta.env.VITE_WS_URL) {
      // Direct WebSocket URL from env (for local development)
      wsUrl = import.meta.env.VITE_WS_URL;
    } else if (import.meta.env.VITE_API_URL) {
      // Construct WebSocket URL from API URL
      const apiUrl = import.meta.env.VITE_API_URL;
      if (apiUrl.startsWith("https://")) {
        wsUrl = apiUrl.replace("https://", "wss://") + "/ws-dashboard";
      } else if (apiUrl.startsWith("http://")) {
        wsUrl = apiUrl.replace("http://", "ws://") + "/ws-dashboard";
      } else {
        wsUrl = `ws://${apiUrl}/ws-dashboard`;
      }
    } else {
      // Fallback to current host
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${protocol}//${window.location.host}/ws-dashboard`;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        isConnectingRef.current = false;
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "initial_data" && message.data) {
            // Process initial data batch
            const esp32Data = message.data
              .filter((d: any) => isValidAudioData(d))
              .map((d: AudioData) => processAudioData(d))
              .pop();
            if (esp32Data) setLastData(esp32Data);
          } else if (message.type === "esp32_status") {
            // Update ESP32 connection status
            setIsESP32Connected(message.connected === true);
          } else if (message.type === "heartbeat") {
            return;
          } else if (isValidAudioData(message)) {
            // Process and normalize incoming audio data
            const processedData = processAudioData(message);
            setLastData(processedData);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        isConnectingRef.current = false;
        setIsConnected(false);
        console.error("WebSocket error:", error);
      };

      ws.onclose = (event) => {
        isConnectingRef.current = false;
        setIsConnected(false);

        // Don't reconnect if it was an intentional close
        if (!shouldReconnectRef.current) {
          return;
        }

        // Exponential backoff with minimum 100ms for fast reconnection
        const baseDelay = 100;
        const maxDelay = 5000;
        const delay = Math.min(
          baseDelay * Math.pow(2, reconnectAttemptsRef.current),
          maxDelay
        );

        reconnectAttemptsRef.current++;

        // Cancel previous timeout if it exists
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (
            shouldReconnectRef.current &&
            (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)
          ) {
            connectWebSocket();
          }
        }, delay);
      };
    } catch (error) {
      isConnectingRef.current = false;
      console.error("Failed to create WebSocket:", error);
      // Retry after short delay
      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (shouldReconnectRef.current) {
          connectWebSocket();
        }
      }, 200);
    }
  }, []);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connectWebSocket();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  const sendFilterSettings = (settings: FilterSettings) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // For bandpass, send both cutoffs, otherwise only cutoffFreq
      const settingsToSend: any = {
        filterType: settings.filterType,
        cutoffFreq: settings.cutoffFreq,
        voiceBoost: settings.voiceBoost,
      };

      // Add cutoffFreqHigh only for bandpass
      if (settings.filterType === "bandpass" && settings.cutoffFreqHigh) {
        settingsToSend.cutoffFreqHigh = settings.cutoffFreqHigh;
      }

      const msg = {
        type: "filter_settings",
        target: "esp32",
        settings: settingsToSend,
      };
      wsRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  };

  return { isConnected, isESP32Connected, lastData, sendFilterSettings };
}
