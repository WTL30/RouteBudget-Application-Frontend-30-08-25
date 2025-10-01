"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import Geolocation, {
  GeoError as GeolocationError,
  GeoPosition as GeolocationResponse,
} from "react-native-geolocation-service";
import axios from "react-native-axios";

import { API_BASE_URL, GOOGLE_MAPS_API_KEY, WS_BASE_URL } from "../utils/config";

interface LatLng {
  latitude: number;
  longitude: number;
}

interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: string;
}

interface LocationFormState {
  from: string;
  to: string;
}

interface ValidationState {
  from: string;
  to: string;
}

interface DriverBroadcastPayload {
  type: "location";
  driverId: string;
  role: "driver";
  location: {
    latitude: number;
    longitude: number;
    timestamp: string;
    phase: TripPhase;
    pickup?: LatLng | null;
    drop?: LatLng | null;
    pickupAddress: string;
    dropAddress: string;
  };
}

type TripPhase = "idle" | "to_pickup" | "pickup_reached" | "to_drop" | "completed";

type TypingField = "from" | "to" | "";

const CACHE_KEY_PREFIX = "location_suggestions_cache";
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const BROADCAST_INTERVAL_MS = 10_000;
const WS_RECONNECT_DELAY_MS = 5_000;
const ARRIVAL_THRESHOLD_METERS = 120;

const POPULAR_CITIES: LocationSuggestion[] = [
  { display_name: "Mumbai, Maharashtra, India", lat: "19.0760", lon: "72.8777", place_id: "mumbai" },
  { display_name: "Delhi, India", lat: "28.6139", lon: "77.2090", place_id: "delhi" },
  { display_name: "Bengaluru, Karnataka, India", lat: "12.9716", lon: "77.5946", place_id: "bengaluru" },
  { display_name: "Hyderabad, Telangana, India", lat: "17.3850", lon: "78.4867", place_id: "hyderabad" },
  { display_name: "Chennai, Tamil Nadu, India", lat: "13.0827", lon: "80.2707", place_id: "chennai" },
  { display_name: "Kolkata, West Bengal, India", lat: "22.5726", lon: "88.3639", place_id: "kolkata" },
  { display_name: "Pune, Maharashtra, India", lat: "18.5204", lon: "73.8567", place_id: "pune" },
  { display_name: "Ahmedabad, Gujarat, India", lat: "23.0225", lon: "72.5714", place_id: "ahmedabad" },
];

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const haversineDistanceInMeters = (a: LatLng, b: LatLng) => {
  const EARTH_RADIUS = 6_371_000; // meters
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS * c;
};

const getCacheKey = (query: string) => `${CACHE_KEY_PREFIX}_${query.toLowerCase().trim()}`;

const LocationScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [location, setLocation] = useState<LocationFormState>({ from: "", to: "" });
  const [validationErrors, setValidationErrors] = useState<ValidationState>({ from: "", to: "" });
  const [searchResults, setSearchResults] = useState<LocationSuggestion[]>([]);
  const [typingField, setTypingField] = useState<TypingField>("");
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cabNumber, setCabNumber] = useState("");
  const [driverId, setDriverId] = useState("");
  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null);
  const [pickupCoordinate, setPickupCoordinate] = useState<LatLng | null>(null);
  const [dropCoordinate, setDropCoordinate] = useState<LatLng | null>(null);
  const [tripPhase, setTripPhase] = useState<TripPhase>("idle");
  const [isTracking, setIsTracking] = useState(false);
  const [hasPromptedPickup, setHasPromptedPickup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const webSocketRef = useRef<WebSocket | null>(null);
  const locationWatchIdRef = useRef<number | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRequestRef = useRef<AbortController | null>(null);
  const typingFlagRef = useRef(false);
  const broadcastIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cacheSuggestions = useCallback(async (query: string, data: LocationSuggestion[]) => {
    try {
      await AsyncStorage.setItem(
        getCacheKey(query),
        JSON.stringify({ data, timestamp: Date.now() }),
      );
    } catch (error) {
      console.error("Error caching suggestions:", error);
    }
  }, []);

  const readCachedSuggestions = useCallback(async (query: string) => {
    try {
      const raw = await AsyncStorage.getItem(getCacheKey(query));
      if (!raw) return null;

      const cache = JSON.parse(raw) as { data: LocationSuggestion[]; timestamp: number };
      if (Date.now() - cache.timestamp > CACHE_EXPIRY_MS) {
        await AsyncStorage.removeItem(getCacheKey(query));
        return null;
      }

      return cache.data;
    } catch (error) {
      console.error("Error reading cached suggestions:", error);
      return null;
    }
  }, []);

  const stopBroadcasting = useCallback(() => {
    if (broadcastIntervalRef.current) {
      clearInterval(broadcastIntervalRef.current);
      broadcastIntervalRef.current = null;
    }
  }, []);

  const closeWebSocket = useCallback(() => {
    if (webSocketRef.current) {
      if (webSocketRef.current.readyState === WebSocket.OPEN) {
        try {
          webSocketRef.current.send(
            JSON.stringify({
              type: "DRIVER_DISCONNECT",
              payload: { driverId, cabNumber },
            }),
          );
        } catch (error) {
          console.error("Error sending disconnect message:", error);
        }
      }
      webSocketRef.current.close();
      webSocketRef.current = null;
    }

    setIsConnected(false);
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    stopBroadcasting();

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, [cabNumber, driverId, stopBroadcasting]);

  const sendLocationUpdate = useCallback(() => {
    if (!webSocketRef.current || webSocketRef.current.readyState !== WebSocket.OPEN) {
      console.log("❌ Cannot send location update - WebSocket not connected")
      return;
    }

    if (!driverId || !currentPosition) {
      console.log("❌ Cannot send location update - missing driverId or currentPosition")
      return;
    }

    const payload: DriverBroadcastPayload = {
      type: "location",
      driverId,
      role: "driver",
      location: {
        latitude: currentPosition.latitude,
        longitude: currentPosition.longitude,
        timestamp: new Date().toISOString(),
        phase: tripPhase,
        pickup: pickupCoordinate,
        drop: dropCoordinate,
        pickupAddress: location.from,
        dropAddress: location.to,
      },
    };

    console.log("📍 Sending location update:", payload);
    try {
      webSocketRef.current.send(JSON.stringify(payload));
      console.log("✅ Location update sent successfully");
    } catch (error) {
      console.error("❌ Error sending location update:", error);
    }
  }, [currentPosition, driverId, dropCoordinate, location.from, location.to, pickupCoordinate, tripPhase]);

  const startBroadcasting = useCallback(() => {
    if (broadcastIntervalRef.current || !isTracking) {
      return;
    }

    sendLocationUpdate();
    broadcastIntervalRef.current = setInterval(sendLocationUpdate, BROADCAST_INTERVAL_MS);
  }, [isTracking, sendLocationUpdate]);

  const connectWebSocket = useCallback(() => {
    if (!driverId) {
      return;
    }

    if (webSocketRef.current && webSocketRef.current.readyState !== WebSocket.CLOSED) {
      return;
    }

    const socket = new WebSocket(WS_BASE_URL);
    webSocketRef.current = socket;

    socket.onopen = () => {
      console.log("🔌 WebSocket connected successfully");
      setIsConnected(true);
      // Start logical heartbeat to keep NAT/firewalls open and also satisfy server keepalive
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      heartbeatRef.current = setInterval(() => {
        try {
          if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
            webSocketRef.current.send(JSON.stringify({ type: "ping" }));
          }
        } catch (e) {}
      }, 25000);

      const registerPayload = {
        type: "register",
        role: "driver",
        driverId,
        metadata: { cabNumber },
      };

      console.log("🚗 Sending driver registration:", registerPayload);
      socket.send(JSON.stringify(registerPayload));

      // Send an immediate location snapshot if we have enough info
      if (currentPosition || pickupCoordinate || dropCoordinate) {
        try {
          sendLocationUpdate();
        } catch (e) {
          console.log("Immediate location send failed:", e);
        }
      }

      if (isTracking) {
        console.log("🚀 Starting location broadcasting");
        startBroadcasting();
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      stopBroadcasting();

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connectWebSocket();
      }, WS_RECONNECT_DELAY_MS);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }, [cabNumber, driverId, isTracking, startBroadcasting, stopBroadcasting]);

  const requestLocationPermission = useCallback(async () => {
    if (Platform.OS === "ios") {
      try {
        const requestAuth = Geolocation.requestAuthorization as unknown as (level?: string) => void;
        requestAuth?.("whenInUse");
      } catch (error) {
        console.warn("requestAuthorization not available", error);
      }
      return true;
    }

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }, []);

  const startLocationWatchers = useCallback(async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      Alert.alert("Permission Denied", "Location permission is required to share your location.");
      return;
    }

    Geolocation.getCurrentPosition(
      (position: GeolocationResponse) => {
        const pos = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCurrentPosition(pos);
        // Send an immediate snapshot if socket is already open
        try {
          if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
            sendLocationUpdate();
          }
        } catch (_) {}
      },
      (error: GeolocationError) => {
        console.error("Initial position error:", error);
        Alert.alert(
          "Location Error",
          `Could not get your current position: ${error.message}`,
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 30_000,
        maximumAge: 60_000,
      },
    );

    locationWatchIdRef.current = Geolocation.watchPosition(
      (position: GeolocationResponse) => {
        const pos = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCurrentPosition(pos);
        // Stream live while connected, even if full tracking not started yet
        try {
          if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
            sendLocationUpdate();
          }
        } catch (_) {}
      },
      (error: GeolocationError) => {
        console.error("Watch position error:", error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10,
        interval: 5_000,
        fastestInterval: 2_000,
      },
    );
  }, [requestLocationPermission]);

  const resolveAddressCoordinate = useCallback(async (address: string) => {
    if (!address.trim()) {
      return null;
    }

    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          address,
        )}&key=${GOOGLE_MAPS_API_KEY}`,
      );

      const result = response.data.results?.[0];
      if (!result) {
        return null;
      }

      const { lat, lng } = result.geometry.location;
      return { latitude: lat, longitude: lng };
    } catch (error) {
      console.error("Geocoding error:", error);
      return null;
    }
  }, []);

  const ensureCoordinates = useCallback(async () => {
    let pickup = pickupCoordinate;
    let drop = dropCoordinate;

    console.log("ensureCoordinates start", {
      pickupCoordinate,
      dropCoordinate,
      pickupAddress: location.from,
      dropAddress: location.to,
    });

    if (!pickup) {
      pickup = await resolveAddressCoordinate(location.from);
      if (pickup) {
        setPickupCoordinate(pickup);
        console.log("Resolved pickup via geocode", pickup);
      }
    }

    if (!drop) {
      drop = await resolveAddressCoordinate(location.to);
      if (drop) {
        setDropCoordinate(drop);
        console.log("Resolved drop via geocode", drop);
      }
    }

    if (!pickup || !drop) {
      Alert.alert(
        "Error",
        "Could not determine coordinates for pickup or drop. Please select from the suggestions list.",
      );
      return null;
    }

    return { pickup, drop };
  }, [dropCoordinate, location.from, location.to, pickupCoordinate, resolveAddressCoordinate]);

  const loadDriverMetadata = useCallback(async () => {
    try {
      const [userId, token] = await Promise.all([
        AsyncStorage.getItem("userid"),
        AsyncStorage.getItem("userToken"),
      ]);

      setDriverId(userId ?? "");

      if (!token) {
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/api/assignCab/driver?ts=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
      });

      if (Array.isArray(response.data) && response.data.length > 0) {
        setCabNumber(response.data[0].CabsDetail?.cabNumber ?? "");
        if (response.data[0].driverId) {
          setDriverId(response.data[0].driverId.toString());
        }
      }
    } catch (error) {
      console.error("Error fetching driver metadata:", error);
    }
  }, []);

  const getInstantSuggestions = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase().trim();
    if (lowerQuery.length < 1) {
      return [];
    }

    return POPULAR_CITIES.filter((city) =>
      city.display_name.toLowerCase().includes(lowerQuery),
    );
  }, []);

  const fetchSearchSuggestions = useCallback(
    async (query: string) => {
      const trimmedQuery = query.trim();
      if (!typingField || trimmedQuery.length < 1) {
        setSearchResults([]);
        setShowSuggestions(false);
        return;
      }

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(async () => {
        if (typingFlagRef.current) {
          return;
        }

        setIsLoadingSuggestions(true);
        setShowSuggestions(true);

        try {
          const instantResults = getInstantSuggestions(trimmedQuery);
          if (instantResults.length > 0) {
            setSearchResults(instantResults);
          }

          if (trimmedQuery.length < 2) {
            setIsLoadingSuggestions(false);
            return;
          }

          const cached = await readCachedSuggestions(trimmedQuery);
          if (cached?.length) {
            setSearchResults(cached);
            setIsLoadingSuggestions(false);
            return;
          }

          if (currentRequestRef.current) {
            currentRequestRef.current.abort();
          }

          const controller = new AbortController();
          currentRequestRef.current = controller;

          const timeout = setTimeout(() => controller.abort(), 8_000);

          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
              trimmedQuery,
            )}&format=json&limit=8&countrycodes=in&addressdetails=1`,
            { signal: controller.signal },
          );

          clearTimeout(timeout);

          if (!controller.signal.aborted) {
            const data = (await response.json()) as LocationSuggestion[];
            const filtered = data
              .filter((item) => item.display_name.toLowerCase().includes(trimmedQuery.toLowerCase()))
              .slice(0, 6);

            const combined = [...instantResults];
            filtered.forEach((result) => {
              const exists = combined.some(
                (existing) => existing.display_name.toLowerCase() === result.display_name.toLowerCase(),
              );

              if (!exists) {
                combined.push(result);
              }
            });

            const finalResults = combined.slice(0, 8);
            setSearchResults(finalResults);

            if (finalResults.length > 0) {
              cacheSuggestions(trimmedQuery, finalResults);
            }
          }
        } catch (error) {
          const typedError = error as { name?: string };
          if (typedError?.name !== "AbortError") {
            const instantResults = getInstantSuggestions(trimmedQuery);
            setSearchResults(instantResults);
          }
        } finally {
          setIsLoadingSuggestions(false);
          currentRequestRef.current = null;
        }
      }, 800);
    },
    [cacheSuggestions, getInstantSuggestions, readCachedSuggestions, typingField],
  );

  const validateInputs = useCallback(() => {
    const errors: ValidationState = { from: "", to: "" };
    let valid = true;

    if (!location.from.trim()) {
      errors.from = "Pickup location is required";
      valid = false;
    }

    if (!location.to.trim()) {
      errors.to = "Drop-off location is required";
      valid = false;
    }

    setValidationErrors(errors);
    return valid;
  }, [location.from, location.to]);

  const handleLocationChange = useCallback((field: "from" | "to", value: string) => {
    typingFlagRef.current = true;

    setLocation((prev) => ({ ...prev, [field]: value }));
    setValidationErrors((prev) => ({
      ...prev,
      [field]: value.trim() ? "" : `${field === "from" ? "Pickup" : "Drop-off"} location is required`,
    }));

    if (field === "from") {
      setPickupCoordinate(null);
    } else {
      setDropCoordinate(null);
    }

    setTimeout(() => {
      typingFlagRef.current = false;
    }, 100);
  }, []);

  const handleSelectSuggestion = useCallback(
    (item: LocationSuggestion) => {
      if (!typingField || item.place_id === "loading") {
        return;
      }

      const address = item.display_name.split(", India")[0];
      const parsedCoordinate: LatLng = {
        latitude: Number.parseFloat(item.lat),
        longitude: Number.parseFloat(item.lon),
      };

      if (typingField === "from") {
        setPickupCoordinate(parsedCoordinate);
      } else {
        setDropCoordinate(parsedCoordinate);
      }

      handleLocationChange(typingField, address);
      setSearchResults([]);
      setTypingField("");
      setShowSuggestions(false);
      setIsLoadingSuggestions(false);
    },
    [handleLocationChange, typingField],
  );

  const handleSubmit = useCallback(async () => {
    if (!validateInputs()) {
      return;
    }

    if (!cabNumber) {
      Alert.alert("Error", "No cab assigned to you yet.");
      return;
    }

    setIsSubmitting(true);

    try {
      const coordinates = await ensureCoordinates();
      console.log("Submitting trip update", coordinates);
      if (!coordinates) {
        setIsSubmitting(false);
        return;
      }

      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        Alert.alert("Error", "Session expired. Please log in again.");
        setIsSubmitting(false);
        return;
      }

      const formData = new FormData();
      formData.append("pickupLocation", location.from);
      formData.append("dropLocation", location.to);
      formData.append("pickupLatitude", coordinates.pickup.latitude.toString());
      formData.append("pickupLongitude", coordinates.pickup.longitude.toString());
      formData.append("dropLatitude", coordinates.drop.latitude.toString());
      formData.append("dropLongitude", coordinates.drop.longitude.toString());

      console.log("PATCH /update-trip payload", {
        pickupLocation: location.from,
        dropLocation: location.to,
        pickupLatitude: coordinates.pickup.latitude,
        pickupLongitude: coordinates.pickup.longitude,
        dropLatitude: coordinates.drop.latitude,
        dropLongitude: coordinates.drop.longitude,
      });

      await axios.patch(`${API_BASE_URL}/api/assigncab/update-trip`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      setTripPhase("to_pickup");
      setIsTracking(true);
      startBroadcasting();

      Alert.alert("Success", "Location sharing started.", [
        {
          text: "OK",
          onPress: onClose,
        },
      ]);
    } catch (error) {
      console.error("Error submitting location:", error);
      Alert.alert("Error", "Failed to submit location. Please try again.");
    } finally {
      setIsSubmitting(false);
      Keyboard.dismiss();
    }
  }, [cabNumber, ensureCoordinates, location.from, location.to, onClose, startBroadcasting, validateInputs]);

  const formatSuggestion = useCallback((displayName: string) => {
    const parts = displayName.split(", ");
    return parts.slice(0, 4).join(", ");
  }, []);

  const handleInputFocus = useCallback((field: "from" | "to") => {
    setTypingField(field);
    const query = field === "from" ? location.from : location.to;
    if (query.trim()) {
      setShowSuggestions(true);
    }
  }, [location.from, location.to]);

  const handleInputBlur = useCallback(() => {
    setTimeout(() => {
      setShowSuggestions(false);
      setTypingField("");
      setSearchResults([]);
      typingFlagRef.current = false;
    }, 200);
  }, []);

  const closeSuggestionsModal = useCallback(() => {
    setShowSuggestions(false);
    setTypingField("");
    setSearchResults([]);
    typingFlagRef.current = false;
    Keyboard.dismiss();
  }, []);

  const renderSuggestion = useCallback(
    ({ item }: { item: LocationSuggestion }) => (
      <TouchableOpacity
        style={styles.suggestionItem}
        onPress={() => {
          handleSelectSuggestion(item);
          closeSuggestionsModal();
        }}
      >
        <MaterialIcons name="place" size={16} color="#666" />
        <Text numberOfLines={2} style={styles.suggestionText}>
          {formatSuggestion(item.display_name)}
        </Text>
      </TouchableOpacity>
    ),
    [closeSuggestionsModal, formatSuggestion, handleSelectSuggestion],
  );

  const SuggestionsModal = useMemo(
    () => () => (
      <Modal
        transparent
        visible={showSuggestions && searchResults.length > 0}
        animationType="fade"
        onRequestClose={closeSuggestionsModal}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeSuggestionsModal}>
          <View style={styles.suggestionsModalContainer}>
            <View style={styles.suggestionsModalContent}>
              <View style={styles.suggestionsHeader}>
                <Text style={styles.suggestionsTitle}>
                  {typingField === "from" ? "Pickup Locations" : "Drop-off Locations"}
                </Text>
                <TouchableOpacity onPress={closeSuggestionsModal}>
                  <MaterialIcons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {isLoadingSuggestions && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FFA726" />
                  <Text style={styles.loadingText}>Searching...</Text>
                </View>
              )}

              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.place_id ?? Math.random().toString()}
                renderItem={renderSuggestion}
                style={styles.suggestionsList}
                showsVerticalScrollIndicator={false}
                maxToRenderPerBatch={10}
                windowSize={10}
              />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    ),
    [closeSuggestionsModal, isLoadingSuggestions, renderSuggestion, searchResults, showSuggestions, typingField],
  );

  // --- Effects ---
  useEffect(() => {
    loadDriverMetadata();
    startLocationWatchers();

    return () => {
      if (locationWatchIdRef.current !== null) {
        Geolocation.clearWatch(locationWatchIdRef.current);
        locationWatchIdRef.current = null;
      }

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }

      if (currentRequestRef.current) {
        currentRequestRef.current.abort();
        currentRequestRef.current = null;
      }

      closeWebSocket();
    };
  }, [closeWebSocket, loadDriverMetadata, startLocationWatchers]);

  useEffect(() => {
    if (driverId) {
      connectWebSocket();
    }
  }, [connectWebSocket, driverId]);

  useEffect(() => {
    fetchSearchSuggestions(typingField === "from" ? location.from : location.to);
  }, [fetchSearchSuggestions, location.from, location.to, typingField]);

  useEffect(() => {
    if (!currentPosition || !pickupCoordinate || tripPhase !== "to_pickup" || hasPromptedPickup) {
      return;
    }

    const distance = haversineDistanceInMeters(currentPosition, pickupCoordinate);
    if (distance <= ARRIVAL_THRESHOLD_METERS) {
      setHasPromptedPickup(true);
      Alert.alert("Reached pickup?", "Have you picked up the customer and want to start navigation to the drop location?", [
        {
          text: "Not yet",
          style: "cancel",
          onPress: () => setHasPromptedPickup(false),
        },
        {
          text: "Start drop navigation",
          onPress: () => {
            setTripPhase("to_drop");
            setHasPromptedPickup(true);
            sendLocationUpdate();
          },
        },
      ]);
    }
  }, [currentPosition, hasPromptedPickup, pickupCoordinate, sendLocationUpdate, tripPhase]);

  useEffect(() => {
    if (!currentPosition || !dropCoordinate || tripPhase !== "to_drop") {
      return;
    }

    const distance = haversineDistanceInMeters(currentPosition, dropCoordinate);
    if (distance <= ARRIVAL_THRESHOLD_METERS) {
      setTripPhase("completed");
      sendLocationUpdate();
      stopBroadcasting();
    }
  }, [currentPosition, dropCoordinate, sendLocationUpdate, stopBroadcasting, tripPhase]);

  useEffect(() => {
    if (tripPhase !== "idle") {
      sendLocationUpdate();
    }
  }, [pickupCoordinate, dropCoordinate, sendLocationUpdate, tripPhase]);

  // --- Render ---
  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <View style={styles.content}>
        <View style={styles.locationContainer}>
          <View style={styles.locationWrapper}>
            <View style={[styles.locationCard, validationErrors.from ? styles.errorCard : null]}>
              <View style={[styles.iconContainer, styles.pickupIcon]}>
                <MaterialIcons name="my-location" size={20} color="#fff" />
              </View>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Pickup Location</Text>
                <TextInput
                  placeholder="Enter pickup location"
                  placeholderTextColor="#999"
                  style={styles.textInput}
                  value={location.from}
                  onFocus={() => handleInputFocus("from")}
                  onBlur={handleInputBlur}
                  onChangeText={(text) => handleLocationChange("from", text)}
                  autoCorrect={false}
                  autoCapitalize="words"
                />
                {validationErrors.from ? <Text style={styles.errorText}>{validationErrors.from}</Text> : null}
              </View>
            </View>
          </View>

          <View style={styles.connectionLine}>
            <View style={styles.dottedLine} />
          </View>

          <View style={styles.locationWrapper}>
            <View style={[styles.locationCard, validationErrors.to ? styles.errorCard : null]}>
              <View style={[styles.iconContainer, styles.dropoffIcon]}>
                <MaterialIcons name="location-on" size={20} color="#fff" />
              </View>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Drop-off Location</Text>
                <TextInput
                  placeholder="Enter drop-off location"
                  placeholderTextColor="#999"
                  style={styles.textInput}
                  value={location.to}
                  onFocus={() => handleInputFocus("to")}
                  onBlur={handleInputBlur}
                  onChangeText={(text) => handleLocationChange("to", text)}
                  autoCorrect={false}
                  autoCapitalize="words"
                />
                {validationErrors.to ? <Text style={styles.errorText}>{validationErrors.to}</Text> : null}
              </View>
            </View>
          </View>
        </View>

        {isTracking && (
          <View style={styles.statusCard}>
            <View style={styles.statusContent}>
              <MaterialIcons name="gps-fixed" size={20} color="#4CAF50" />
              <Text style={styles.statusCardText}>
                {tripPhase === "to_pickup"
                  ? "Heading to pickup point"
                  : tripPhase === "to_drop"
                    ? "Heading to drop location"
                    : tripPhase === "completed"
                      ? "Trip completed"
                      : "Location sharing active"}
              </Text>
            </View>
            <View style={styles.pulseAnimation}>
              <View style={styles.pulse} />
            </View>
          </View>
        )}

        {/* Debug Coordinate Display */}
        {(pickupCoordinate || dropCoordinate) && (
          <View style={styles.debugCard}>
            <Text style={styles.debugTitle}>📍 Coordinate Debug Info</Text>

            {currentPosition && (
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Current GPS:</Text>
                <Text style={styles.debugValue}>
                  {currentPosition.latitude.toFixed(6)}, {currentPosition.longitude.toFixed(6)}
                </Text>
              </View>
            )}

            {pickupCoordinate && (
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Pickup:</Text>
                <Text style={styles.debugValue}>
                  {pickupCoordinate.latitude.toFixed(6)}, {pickupCoordinate.longitude.toFixed(6)}
                </Text>
              </View>
            )}

            {dropCoordinate && (
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Drop:</Text>
                <Text style={styles.debugValue}>
                  {dropCoordinate.latitude.toFixed(6)}, {dropCoordinate.longitude.toFixed(6)}
                </Text>
              </View>
            )}

            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Will Submit:</Text>
              <Text style={styles.debugValue}>
                {pickupCoordinate && dropCoordinate
                  ? `${pickupCoordinate.latitude.toFixed(6)}, ${pickupCoordinate.longitude.toFixed(6)} → ${dropCoordinate.latitude.toFixed(6)}, ${dropCoordinate.longitude.toFixed(6)}`
                  : "Waiting for both coordinates"}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submittingButton]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="send" size={20} color="#fff" />
          )}
          <Text style={styles.submitButtonText}>{isSubmitting ? "Submitting..." : "Submit Location"}</Text>
        </TouchableOpacity>
      </View>

      <SuggestionsModal />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fefefe",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  locationContainer: {
    marginTop: 12,
    gap: 14,
  },
  locationWrapper: {
    borderRadius: 12,
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f5f5f5",
  },
  errorCard: {
    borderColor: "#FF5722",
    borderWidth: 1.5,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  pickupIcon: {
    backgroundColor: "#4CAF50",
  },
  dropoffIcon: {
    backgroundColor: "#FF5722",
  },
  inputWrapper: {
    flex: 1,
    gap: 2,
  },
  inputLabel: {
    fontSize: 12,
    color: "#FFA726",
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  textInput: {
    fontSize: 15,
    color: "#333",
    paddingVertical: 2,
    fontWeight: "500",
  },
  errorText: {
    fontSize: 12,
    color: "#FF5722",
    marginTop: 4,
    fontWeight: "500",
  },
  connectionLine: {
    alignItems: "center",
  },
  dottedLine: {
    width: 2,
    height: 18,
    backgroundColor: "#E0E0E0",
    borderRadius: 1,
  },
  statusCard: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusCardText: {
    color: "#2E7D32",
    fontWeight: "600",
  },
  pulseAnimation: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(76, 175, 80, 0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  pulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4CAF50",
  },
  debugCard: {
    marginTop: 16,
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FFE0B2",
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E65100",
    marginBottom: 8,
  },
  debugRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#FFE0B2",
  },
  debugLabel: {
    fontSize: 12,
    color: "#BF360C",
    fontWeight: "500",
  },
  debugValue: {
    fontSize: 12,
    color: "#3E2723",
    fontWeight: "600",
    textAlign: "right",
    flex: 1,
    marginLeft: 8,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 16,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF9800",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  submittingButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  suggestionsModalContainer: {
    width: "90%",
    maxHeight: "60%",
  },
  suggestionsModalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  suggestionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  suggestionsTitle: {
    fontWeight: "700",
    fontSize: 16,
    color: "#333",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: "#666",
  },
  suggestionsList: {
    maxHeight: 260,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#eee",
  },
  suggestionText: {
    flex: 1,
    color: "#444",
  },
});

export default LocationScreen;
