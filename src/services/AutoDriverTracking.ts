import AsyncStorage from "@react-native-async-storage/async-storage";
import Geolocation, { GeoPosition as GeolocationResponse } from "react-native-geolocation-service";
import { PermissionsAndroid, Platform } from "react-native";
import { API_BASE_URL, WS_BASE_URL } from "../utils/config";
import axios from "react-native-axios";

interface LatLng {
  latitude: number;
  longitude: number;
}

let ws: WebSocket | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let watchId: number | null = null;
let currentPosition: LatLng | null = null;
let driverId: string | null = null;
let cabNumber: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;

const WS_RECONNECT_BASE_MS = 2000; // backoff base

const requestLocationPermission = async () => {
  if (Platform.OS === "ios") {
    try {
      // @ts-ignore - RN community types vary
      Geolocation.requestAuthorization?.("whenInUse");
    } catch {}
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

const loadDriverMeta = async () => {
  const [uid, token] = await Promise.all([
    AsyncStorage.getItem("userid"),
    AsyncStorage.getItem("userToken"),
  ]);
  driverId = uid;
  if (!token) return;

  try {
    const resp = await axios.get(`${API_BASE_URL}/api/assignCab/driver?ts=${Date.now()}` ,{
      headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
    });
    const data = Array.isArray(resp.data) ? resp.data : resp.data?.assignment || [];
    if (Array.isArray(data) && data.length > 0) {
      cabNumber = data[0]?.CabsDetail?.cabNumber ?? null;
      if (!driverId && data[0]?.driverId) {
        driverId = String(data[0].driverId);
      }
    }
  } catch (e) {
    // ignore
  }
};

const sendPing = () => {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ping" }));
    }
  } catch {}
};

const sendLocationUpdate = () => {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!driverId || !currentPosition) return;
    ws.send(
      JSON.stringify({
        type: "location",
        driverId,
        role: "driver",
        location: {
          latitude: currentPosition.latitude,
          longitude: currentPosition.longitude,
          timestamp: new Date().toISOString(),
          phase: "idle",
        },
      }),
    );
  } catch {}
};

const startHeartbeat = () => {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = setInterval(sendPing, 25000);
};

const stopHeartbeat = () => {
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
};

const connectSocket = () => {
  if (!driverId) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  ws = new WebSocket(WS_BASE_URL);

  ws.onopen = () => {
    reconnectAttempts = 0;
    startHeartbeat();
    try {
      ws?.send(
        JSON.stringify({
          type: "register",
          role: "driver",
          driverId,
          metadata: { cabNumber },
        }),
      );
    } catch {}

    // send immediate snapshot if we already have a position
    sendLocationUpdate();
  };

  ws.onmessage = () => {
    // no-op
  };

  ws.onerror = () => {
    // wait for close to handle reconnect
  };

  ws.onclose = () => {
    stopHeartbeat();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectAttempts += 1;
    const delay = Math.min(WS_RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts), 30000);
    reconnectTimer = setTimeout(connectSocket, delay);
  };
};

const startLocationWatch = async () => {
  const hasPerm = await requestLocationPermission();
  if (!hasPerm) return;

  Geolocation.getCurrentPosition(
    (pos: GeolocationResponse) => {
      currentPosition = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      sendLocationUpdate();
    },
    () => {},
    { enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 },
  );

  watchId = Geolocation.watchPosition(
    (pos: GeolocationResponse) => {
      currentPosition = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      sendLocationUpdate();
    },
    () => {},
    { enableHighAccuracy: true, distanceFilter: 10, interval: 5000, fastestInterval: 2000 },
  );
};

export const startAutoTracking = async () => {
  await loadDriverMeta();
  connectSocket();
  await startLocationWatch();
};

export const stopAutoTracking = () => {
  if (watchId !== null) {
    Geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (ws) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: "DRIVER_DISCONNECT", payload: { driverId, cabNumber } }),
        );
      }
    } catch {}
    ws.close();
    ws = null;
  }
  stopHeartbeat();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};
