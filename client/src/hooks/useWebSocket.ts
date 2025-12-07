import { useCallback, useEffect, useRef, useState } from "react";
import { AudioData, processAudioData, isValidAudioData } from "../services/api";

interface FilterSettings {
  filterType: string;
  cutoffFreq: number;
  voiceBoost: number;
  updateRate: number;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [isESP32Connected, setIsESP32Connected] = useState(false);
  const [lastData, setLastData] = useState<AudioData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connectWebSocket = useCallback(() => {
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

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
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

    ws.onerror = () => setIsConnected(false);

    ws.onclose = () => {
      setIsConnected(false);
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.CLOSED) {
          connectWebSocket();
        }
      }, 1000);
    };
  }, []);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  const sendFilterSettings = (settings: FilterSettings) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const msg = {
        type: "filter_settings",
        target: "esp32",
        settings,
      };
      wsRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  };

  return { isConnected, isESP32Connected, lastData, sendFilterSettings };
}
