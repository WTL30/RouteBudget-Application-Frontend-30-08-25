"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Animated,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  PermissionsAndroid,
  Platform,
  Image,
} from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import axios from "react-native-axios"
import MaterialIcons from "react-native-vector-icons/MaterialIcons"
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from "react-native-maps"
import Geolocation from "react-native-geolocation-service"
import Tts from "react-native-tts"

import { API_BASE_URL, GOOGLE_MAPS_API_KEY, WS_BASE_URL } from "../utils/config"

const { width, height } = Dimensions.get("window")
type TripPhase = "idle" | "to_pickup" | "pickup_reached" | "to_drop" | "completed"

const SKY_BLUE = "#1E90FF"
const MAP_EDGE_PADDING = { top: 80, right: 80, bottom: 120, left: 80 }

interface TripData {
  customerName: string | null
  customerPhone: string | null
  pickupLocation: string | null
  dropLocation: string | null
  tripType: string | null
  vehicleType: string | null
  duration: string | null
  estimatedDistance: string | null
  estimatedFare: number | null
  actualFare: number | null
  scheduledPickupTime: string | null
  actualPickupTime: string | null
  dropTime: string | null
  specialInstructions: string | null
  adminNotes: string | null
  id?: number | null
  driverId?: number | null
  pickupLatitude?: number | null
  pickupLongitude?: number | null
  dropLatitude?: number | null
  dropLongitude?: number | null
}

interface CustomerDetailScreenProps {
  onClose: () => void
}

interface LocationCoords {
  latitude: number
  longitude: number
}

type MapMode = "full" | "toPickup" | "pickupToDrop"

interface RouteStepInfo {
  instruction: string
  distanceMeters: number
  endLocation: LocationCoords
  turnType: "straight" | "left" | "right" | "slight_left" | "slight_right" | "u_turn"
}

interface RouteResult {
  coordinates: LocationCoords[]
  steps: RouteStepInfo[]
}

const stripHtmlTags = (value: string): string => value.replace(/<[^>]*>?/g, "").replace(/&nbsp;/g, " ")

const normalizeInstruction = (value: string): string => {
  const cleaned = stripHtmlTags(value).replace(/\s+/g, " ").trim()
  const headMatch = cleaned.match(/^Head\s+([A-Za-z]+)(.*)$/)

  if (headMatch) {
    const direction = headMatch[1].toLowerCase()
    const remainder = headMatch[2].trim()
    const straightWords = new Set([
      "north",
      "south",
      "east",
      "west",
      "northeast",
      "northwest",
      "southeast",
      "southwest",
    ])

    if (straightWords.has(direction)) {
      const suffix = remainder ? ` ${remainder.replace(/^on\s+/i, "on ")}` : ""
      return `Go straight${suffix}`.trim()
    }
  }

  return cleaned
}

const formatDistance = (meters: number): string => {
  if (!Number.isFinite(meters) || meters < 0) {
    return "0 m"
  }

  if (meters >= 1000) {
    const km = meters / 1000
    return `${km >= 10 ? Math.round(km) : Number(km.toFixed(1))} km`
  }

  if (meters >= 100) {
    return `${Math.round(meters / 10) * 10} m`
  }

  return `${Math.max(5, Math.round(meters / 5) * 5)} m`
}

const STEP_COMPLETION_THRESHOLD_METERS = 35

// Hindi TTS Phrases
const HINDI_PHRASES = {
  turn_left: {
    pre: "50 meters के बाद बाएं मुड़ें",
    at: "50 meters के बाद बाएं मुड़ें"
  },
  turn_right: {
    pre: "50 meters के बाद दाएं मुड़ें",
    at: "50 meters के बाद दाएं मुड़ें"
  },
  straight: {
    pre: "50 meters तक सीधे चलें",
    at: "50 meters तक सीधे चलें"
  },
  slight_left: {
    pre: "50 meters के बाद हल्का बाएं मुड़ें",
    at: "50 meters के बाद हल्का बाएं मुड़ें"
  },
  slight_right: {
    pre: "50 meters के बाद हल्का दाएं मुड़ें",
    at: "50 meters के बाद हल्का दाएं मुड़ें"
  },
  u_turn: {
    pre: "50 meters के बाद यू-टर्न लें",
    at: "50 meters के बाद यू-टर्न लें"
  }
}

const extractTurnType = (raw: string): "straight" | "left" | "right" | "slight_left" | "slight_right" | "u_turn" => {
  const text = raw.toLowerCase()

  if (/u-turn|u turn/.test(text)) return "u_turn"
  if (/slight left/.test(text)) return "slight_left"
  if (/slight right/.test(text)) return "slight_right"
  if (/turn left|left onto|keep left/.test(text)) return "left"
  if (/turn right|right onto|keep right/.test(text)) return "right"
  return "straight"
}

const CustomerDetailScreen: React.FC<CustomerDetailScreenProps> = ({ onClose }) => {
  const [cabNumber, setCabNumber] = useState<string>("")
  const [tripData, setTripData] = useState<TripData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [fadeAnim] = useState(new Animated.Value(0))
  const [slideAnim] = useState(new Animated.Value(20))

  const [showMapModal, setShowMapModal] = useState<boolean>(false)
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null)
  const [pickupCoords, setPickupCoords] = useState<LocationCoords | null>(null)
  const [dropCoords, setDropCoords] = useState<LocationCoords | null>(null)
  const [mapLoading, setMapLoading] = useState<boolean>(false)
  const [polylineCoords, setPolylineCoords] = useState<LocationCoords[]>([])
  const [guidanceSteps, setGuidanceSteps] = useState<RouteStepInfo[]>([])
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0)
  const [activeStepDistance, setActiveStepDistance] = useState<string>("")
  const [activeStepMeters, setActiveStepMeters] = useState<number | null>(null)
  const [carRotation, setCarRotation] = useState<number>(0)
  const [showStartTripButton, setShowStartTripButton] = useState<boolean>(false)
  const [showEndTripButton, setShowEndTripButton] = useState<boolean>(false)
  const [mapMode, setMapMode] = useState<MapMode>("full")
  const [watchId, setWatchId] = useState<number | null>(null)
  const [tripPhase, setTripPhase] = useState<TripPhase>("idle")
  const [isTrackerZoomed, setIsTrackerZoomed] = useState<boolean>(false)
  const prevLocationRef = useRef<LocationCoords | null>(null)
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true)
  const [ttsInitialized, setTtsInitialized] = useState<boolean>(false)
  const [spokenSteps, setSpokenSteps] = useState<Set<string>>(new Set())
  const ttsRef = useRef<any>(null)
  const [isSocketConnected, setIsSocketConnected] = useState(false)
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [driverId, setDriverId] = useState<string | null>(null)
  const mapRef = useRef<MapView | null>(null)
  const websocketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<{ timeout: NodeJS.Timeout | null; retryCount: number }>({
    timeout: null,
    retryCount: 0,
  })

  const activeGuidanceStep = guidanceSteps.length > 0 ? guidanceSteps[Math.min(activeStepIndex, guidanceSteps.length - 1)] : null
  const activeTurnIcon = useMemo(() => {
    if (!activeGuidanceStep) return "navigation"
    switch (activeGuidanceStep.turnType) {
      case "left":
        return "turn-left"
      case "right":
        return "turn-right"
      case "slight_left":
        return "turn-slight-left"
      case "slight_right":
        return "turn-slight-right"
      case "u_turn":
        return "u-turn-left"
      default:
        return "arrow-upward"
    }
  }, [activeGuidanceStep])

  const shouldShowGuidance = useMemo(() => {
    if (!activeGuidanceStep) return false
    if (activeStepMeters == null) return false
    return activeStepMeters <= 100
  }, [activeGuidanceStep, activeStepMeters])

  const guidanceTitle = useMemo(() => {
    if (!activeGuidanceStep) return ""
    switch (activeGuidanceStep.turnType) {
      case "left":
        return "Turn left"
      case "right":
        return "Turn right"
      case "slight_left":
        return "Keep left"
      case "slight_right":
        return "Keep right"
      case "u_turn":
        return "Make a U-turn"
      default:
        return "Go straight"
    }
  }, [activeGuidanceStep])

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const lastConnectionAttemptRef = useRef<number>(0)
  const CONNECTION_COOLDOWN = 2000 // 2 seconds cooldown between connection attempts
  const pendingRouteRef = useRef<{ origin: LocationCoords; destination: LocationCoords } | null>(null)
  const lastRouteRef = useRef<RouteResult | null>(null)
  const geocodeCacheRef = useRef<Map<string, LocationCoords>>(new Map())

  // TTS Functions
  const initializeTTS = async () => {
    try {
      // Set language to Hindi
      await Tts.setDefaultLanguage('hi-IN')
      await Tts.setDefaultRate(0.5)
      await Tts.setDefaultPitch(1.0)

      // Check if TTS is available
      const voices = await Tts.voices()
      const hindiVoice = voices.find(voice => voice.language.includes('hi'))

      if (hindiVoice) {
        await Tts.setDefaultVoice(hindiVoice.id)
        console.log('Hindi voice set successfully')
      }

      setTtsInitialized(true)
      console.log('TTS initialized successfully')
    } catch (error) {
      console.log('TTS initialization error:', error)
    }
  }

  const speakInstruction = async (instruction: string) => {
    if (!ttsEnabled || !ttsInitialized) return

    try {
      await Tts.speak(instruction, {
        iosVoiceId: 'hi-IN',
        rate: 0.5,
        androidParams: {
          KEY_PARAM_PAN: 0,
          KEY_PARAM_VOLUME: 1,
          KEY_PARAM_STREAM: 'STREAM_MUSIC',
        },
      })
    } catch (error) {
      console.log('TTS speak error:', error)
    }
  }

  const getHindiInstruction = (turnType: string, isPreAlert: boolean = false, originalInstruction?: string): string => {
    const phrases = HINDI_PHRASES[turnType as keyof typeof HINDI_PHRASES]
    if (!phrases) {
      // अगर Hindi phrase नहीं मिला तो original English instruction वापस करो
      return originalInstruction || "Continue straight"
    }

    return isPreAlert ? phrases.pre : phrases.at
  }

  const speakGuidanceStep = async (step: RouteStepInfo, isPreAlert: boolean = false) => {
    if (!ttsEnabled || !ttsInitialized) return

    const stepKey = `${step.instruction}-${isPreAlert}`
    if (spokenSteps.has(stepKey)) return

    const hindiInstruction = getHindiInstruction(step.turnType, isPreAlert, step.instruction)
    await speakInstruction(hindiInstruction)

    setSpokenSteps(prev => new Set([...prev, stepKey]))
  }

  const toggleTTS = async () => {
    const newState = !ttsEnabled
    setTtsEnabled(newState)

    if (newState && !ttsInitialized) {
      await initializeTTS()
    }
  }

  const applySimpleRoute = useCallback(
    (points: LocationCoords[], options?: { fitToRoute?: boolean; preserveZoom?: boolean }) => {
      lastRouteRef.current = { coordinates: points, steps: [] }
      setPolylineCoords(points)
      setGuidanceSteps([])
      setActiveStepIndex(0)
      setActiveStepDistance("")
      setActiveStepMeters(null)

      if (!options?.preserveZoom) {
        setIsTrackerZoomed(false)
      }

      if (options?.fitToRoute !== false && mapRef.current) {
        if (points.length >= 2) {
          mapRef.current.fitToCoordinates(points, {
            edgePadding: MAP_EDGE_PADDING,
            animated: true,
          })
        } else if (points.length === 1) {
          mapRef.current.animateToRegion(
            {
              latitude: points[0].latitude,
              longitude: points[0].longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            600,
          )
        }
      }
    },
    [isTrackerZoomed],
  )

  const updateGuidanceProgress = useCallback(
    (driverPoint: LocationCoords, stepsOverride?: RouteStepInfo[]) => {
      const steps = stepsOverride ?? guidanceSteps
      if (steps.length === 0) {
        if (activeStepIndex !== 0) {
          setActiveStepIndex(0)
        }
        if (activeStepDistance !== "") {
          setActiveStepDistance("")
        }
        setActiveStepMeters(null)
        return
      }

      let idx = Math.min(activeStepIndex, steps.length - 1)
      let remaining = calculateDistance(driverPoint, steps[idx].endLocation)

      while (remaining <= STEP_COMPLETION_THRESHOLD_METERS && idx < steps.length - 1) {
        idx += 1
        remaining = calculateDistance(driverPoint, steps[idx].endLocation)
      }

      if (idx !== activeStepIndex) {
        setActiveStepIndex(idx)
        // Speak the new step instruction
        if (steps[idx] && ttsEnabled && ttsInitialized) {
          speakGuidanceStep(steps[idx], false)
        }
      }

      // Pre-alert when approaching next step (within 100 meters)
      if (remaining <= 100 && remaining > 50 && idx < steps.length - 1) {
        const nextStep = steps[idx + 1]
        if (nextStep && !spokenSteps.has(`${nextStep.instruction}-pre`)) {
          speakGuidanceStep(nextStep, true)
        }
      }

      setActiveStepMeters(remaining)
      setActiveStepDistance(remaining > 0 ? formatDistance(remaining) : "")
    },
    [guidanceSteps, activeStepIndex, activeStepDistance],
  )

  const applyRouteResult = useCallback(
    (route: RouteResult, options?: { fitToRoute?: boolean; preserveZoom?: boolean }) => {
      lastRouteRef.current = route
      setPolylineCoords(route.coordinates)
      setGuidanceSteps(route.steps)
      setActiveStepIndex(0)
      if (route.steps.length === 0) {
        setActiveStepDistance("")
        setActiveStepMeters(null)
      }

      if (!options?.preserveZoom) {
        setIsTrackerZoomed(false)
      }

      if (options?.fitToRoute !== false && mapRef.current) {
        if (route.coordinates.length >= 2) {
          mapRef.current.fitToCoordinates(route.coordinates, {
            edgePadding: MAP_EDGE_PADDING,
            animated: true,
          })
        } else if (route.coordinates.length === 1) {
          const point = route.coordinates[0]
          mapRef.current.animateToRegion(
            {
              latitude: point.latitude,
              longitude: point.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            600,
          )
        }
      }
      if (route.steps.length > 0) {
        const basePoint = currentLocation ?? route.coordinates[0] ?? null
        if (basePoint) {
          updateGuidanceProgress(basePoint, route.steps)
        } else {
          const meters = route.steps[0].distanceMeters
          setActiveStepMeters(meters)
          setActiveStepDistance(formatDistance(meters))
        }
      }
    },
    [currentLocation, isTrackerZoomed, updateGuidanceProgress],
  )

  const focusOnDriver = useCallback(
    (zoomed: boolean) => {
      if (!mapRef.current || !currentLocation) {
        return
      }

      if (zoomed) {
        mapRef.current.animateCamera(
          {
            center: currentLocation,
            zoom: 17,
            pitch: 0,
            heading: 0,
          },
          { duration: 600 },
        )
      } else if (lastRouteRef.current?.coordinates?.length) {
        mapRef.current.fitToCoordinates(lastRouteRef.current.coordinates, {
          edgePadding: MAP_EDGE_PADDING,
          animated: true,
        })
      } else {
        mapRef.current.animateCamera(
          {
            center: currentLocation,
            zoom: 14,
            pitch: 0,
            heading: 0,
          },
          { duration: 600 },
        )
      }
    },
    [currentLocation],
  )

  const toggleTrackerZoom = useCallback(() => {
    if (!currentLocation) {
      Alert.alert("Driver location unavailable", "Waiting for live location before zooming to the vehicle.")
      return
    }

    const next = !isTrackerZoomed
    setIsTrackerZoomed(next)
    focusOnDriver(next)
  }, [currentLocation, isTrackerZoomed, focusOnDriver])

  useEffect(() => {
    if (isTrackerZoomed && currentLocation) {
      focusOnDriver(true)
    }
  }, [isTrackerZoomed, currentLocation, focusOnDriver])

  const closeMapModal = useCallback(() => {
    console.log("Closing map modal")
    setShowMapModal(false)
    setMapMode("full")
    setMapLoading(false)
    setPolylineCoords([])
    setGuidanceSteps([])
    setActiveStepIndex(0)
    setActiveStepDistance("")
    setActiveStepMeters(null)
    setIsTrackerZoomed(false)
    lastRouteRef.current = null
    // Clear pending route
    pendingRouteRef.current = null
  }, [])

  useEffect(() => {
    const initializeScreen = async () => {
      // 1. Load essential data first (fastest operations)
      await loadViewerIdentifier()

      // 2. Start animations immediately (UI responsiveness)
      startAnimations()

      // 3. Load trip data in parallel with other operations
      const tripDataPromise = getAssignedCab()

      // 4. Initialize TTS only if needed (can be slow)
      const ttsPromise = ttsEnabled ? initializeTTS() : Promise.resolve()

      // 5. Wait for critical data before proceeding
      await Promise.all([tripDataPromise, ttsPromise])
    }
    initializeScreen()

    return () => {
      if (watchId !== null) {
        Geolocation.clearWatch(watchId)
      }
      cleanupSocket()
    }
  }, [])

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const requestLocationPermission = async () => {
    if (Platform.OS === "android") {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ])

        if (
          granted["android.permission.ACCESS_FINE_LOCATION"] === PermissionsAndroid.RESULTS.GRANTED &&
          granted["android.permission.ACCESS_COARSE_LOCATION"] === PermissionsAndroid.RESULTS.GRANTED
        ) {
          getCurrentLocation()
          startLocationTracking()
        }
      } catch (err) {
        console.warn(err)
      }
    } else {
      getCurrentLocation()
      startLocationTracking()
    }
  }

  const getCurrentLocation = () => {
    const tryHighAccuracy = () => {
      Geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }
          setCurrentLocation(newLocation)

          if (mapRef.current) {
            mapRef.current.animateToRegion(
              {
                latitude: newLocation.latitude,
                longitude: newLocation.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              },
              1000,
            )
          }
        },
        (error) => {
          console.log("High accuracy location failed, trying low accuracy:", error)
          tryLowAccuracy()
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 10000,
        },
      )
    }

    const tryLowAccuracy = () => {
      Geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }
          setCurrentLocation(newLocation)

          if (mapRef.current) {
            mapRef.current.animateToRegion(
              {
                latitude: newLocation.latitude,
                longitude: newLocation.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              },
              1000,
            )
          }
        },
        (error) => {
          console.log("Location error:", error)
          let errorMessage = "Unable to get your current location. "
          switch (error.code) {
            case 1:
              errorMessage += "Please enable location permissions in settings."
              break
            case 2:
              errorMessage += "Location services are not available. Please check your GPS settings."
              break
            case 3:
              errorMessage += "Location request timed out. Please ensure you have a good GPS signal and try again."
              break
            default:
              errorMessage += "Please check your GPS settings and try again."
          }
          Alert.alert("Location Error", errorMessage)
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 30000,
        },
      )
    }

    tryHighAccuracy()
  }

  const startLocationTracking = () => {
    const id = Geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (error) => {
        console.log("Location tracking error:", error)
      },
      {
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 10000,
        distanceFilter: 5,
      },
    )
    setWatchId(id)
  }

  const geocodeAddress = async (address: string): Promise<LocationCoords | null> => {
    // Check cache first to avoid repeated API calls
    const cacheKey = `geocode_${address.toLowerCase()}`
    const cached = geocodeCacheRef.current.get(cacheKey)
    if (cached) {
      console.log("Using cached geocode for:", address)
      return cached
    }

    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`,
      )

      if (response.data.results && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location
        const result = {
          latitude: location.lat,
          longitude: location.lng,
        }
        // Cache the result
        geocodeCacheRef.current.set(cacheKey, result)
        return result
      }
    } catch (error) {
      console.log("Geocoding error (Google):", error)
    }

    // Fallback: OpenStreetMap Nominatim
    try {
      const nom = await axios.get(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'RouteBudgetApp/1.0 (contact: support@example.com)' } }
      )
      if (Array.isArray(nom.data) && nom.data.length > 0) {
        const best = nom.data[0]
        const lat = parseFloat(best.lat)
        const lon = parseFloat(best.lon)
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          console.log(`Geocoded address using OSM fallback: ${address} -> ${lat},${lon}`)
          const result = { latitude: lat, longitude: lon }
          geocodeCacheRef.current.set(cacheKey, result)
          return result
        }
      }
    } catch (e) {
      console.log('Geocoding error (OSM fallback):', e)
    }

    return null
  }

  // Polyline decoder (Google/OSRM 1e5 encoded)
  const decodePolyline = (encoded: string): LocationCoords[] => {
    const points: LocationCoords[] = []
    let index = 0
    let lat = 0
    let lng = 0
    const len = encoded.length

    while (index < len) {
      let b: number
      let shift = 0
      let result = 0
      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      const dlat = (result & 1) ? ~(result >> 1) : (result >> 1)
      lat += dlat

      shift = 0
      result = 0
      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      const dlng = (result & 1) ? ~(result >> 1) : (result >> 1)
      lng += dlng

      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 })
    }

    return points
  }

  const getDirections = async (origin: LocationCoords, destination: LocationCoords): Promise<RouteResult> => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${GOOGLE_MAPS_API_KEY}`,
      )

      if (response.data.routes && response.data.routes.length > 0) {
        const route = response.data.routes[0]
        const points = decodePolyline(route.overview_polyline.points)

        const steps: RouteStepInfo[] = []
        const legs = Array.isArray(route.legs) ? route.legs : []
        legs.forEach((leg: any) => {
          const legSteps = Array.isArray(leg.steps) ? leg.steps : []
          legSteps.forEach((step: any) => {
            const rawInstruction = typeof step.html_instructions === "string" ? step.html_instructions : ""
            const instruction = rawInstruction ? normalizeInstruction(rawInstruction) : ""
            const distanceMeters = Number(step?.distance?.value) || 0
            const endLoc = step?.end_location
            if (instruction && endLoc && Number.isFinite(endLoc.lat) && Number.isFinite(endLoc.lng)) {
              steps.push({
                instruction,
                distanceMeters,
                endLocation: {
                  latitude: Number(endLoc.lat),
                  longitude: Number(endLoc.lng),
                },
                turnType: extractTurnType(instruction || rawInstruction),
              })
            }
          })
        })

        return { coordinates: points, steps }
      }
    } catch (error) {
      console.log("Directions error (Google):", error)
    }

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=polyline`
      const resp = await axios.get(url)
      if (resp.data && resp.data.routes && resp.data.routes.length > 0 && resp.data.routes[0].geometry) {
        const poly = resp.data.routes[0].geometry
        return { coordinates: decodePolyline(poly), steps: [] }
      }
    } catch (e) {
      console.log("Directions error (OSRM fallback):", e)
    }

    // Fallback: straight line when routing services fail
    return { coordinates: [origin, destination], steps: [] }
  }

  const ensurePickupDropCoordinates = useCallback(async () => {
    let ensuredPickup = pickupCoords
    let ensuredDrop = dropCoords

    try {
      if (!ensuredPickup && tripData?.pickupLatitude && tripData?.pickupLongitude) {
        ensuredPickup = {
          latitude: Number(tripData.pickupLatitude),
          longitude: Number(tripData.pickupLongitude),
        }
        setPickupCoords(ensuredPickup)
        console.log("Using database pickup coords ->", ensuredPickup)
      } else if (!ensuredPickup && tripData?.pickupLocation) {
        console.log("Geocoding pickup address", tripData.pickupLocation)
        ensuredPickup = await geocodeAddress(tripData.pickupLocation)
        if (ensuredPickup) {
          setPickupCoords(ensuredPickup)
          console.log("Geocoded pickup ->", ensuredPickup)
        }
      }

      if (!ensuredDrop && tripData?.dropLatitude && tripData?.dropLongitude) {
        ensuredDrop = {
          latitude: Number(tripData.dropLatitude),
          longitude: Number(tripData.dropLongitude),
        }
        setDropCoords(ensuredDrop)
        console.log("Using database drop coords ->", ensuredDrop)
      } else if (!ensuredDrop && tripData?.dropLocation) {
        console.log("Geocoding drop address", tripData.dropLocation)
        ensuredDrop = await geocodeAddress(tripData.dropLocation)
        if (ensuredDrop) {
          setDropCoords(ensuredDrop)
          console.log("Geocoded drop ->", ensuredDrop)
        }
      }
    } catch (error) {
      console.log("Error ensuring pickup/drop coordinates:", error)
    }

    if (ensuredPickup && ensuredDrop) {
      return { pickup: ensuredPickup, drop: ensuredDrop }
    }

    return null
  }, [dropCoords, geocodeAddress, pickupCoords, tripData])

  const handleTrackLocation = async () => {
    setMapLoading(true)
    setShowMapModal(true)
    setMapMode("toPickup")
    setShowStartTripButton(false)

    try {
      // 1. Check prerequisites first
      if (!currentLocation || !pickupCoords) {
        Alert.alert("Route unavailable", "Waiting for the driver's live location and pickup coordinate.")
        closeMapModal()
        return
      }

      // 2. Get route data asynchronously (don't block UI)
      const routePromise = getDirections(currentLocation, pickupCoords)

      // 3. Set basic route immediately for faster visual feedback
      setPolylineCoords([currentLocation, pickupCoords])

      // 4. Wait for detailed route and apply it
      const routeResult = await routePromise
      console.log("handleTrackLocation polyline points", routeResult.coordinates.length)
      applyRouteResult(routeResult, { preserveZoom: isTrackerZoomed })
      pendingRouteRef.current = { origin: currentLocation, destination: pickupCoords }
    } catch (error) {
      console.log("Track location error:", error)
      Alert.alert("Error", "Failed to load map data.")
      closeMapModal()
    } finally {
      setMapLoading(false)
    }
  }

  const handleStartTrip = async () => {
    if (!pickupCoords || !dropCoords) {
      Alert.alert("Route unavailable", "Drop coordinates not available.")
      return
    }

    setShowStartTripButton(false)
    setTripPhase("to_drop")
    setMapMode("pickupToDrop")

    const origin = currentLocation ?? pickupCoords

    try {
      console.log("handleStartTrip using coords", { origin, drop: dropCoords })
      const routeResult = await getDirections(origin, dropCoords)
      console.log("handleStartTrip polyline points", routeResult.coordinates.length)
      applyRouteResult(routeResult, { preserveZoom: isTrackerZoomed })
      pendingRouteRef.current = { origin, destination: dropCoords }
    } catch (error) {
      console.log("Start trip error:", error)
      Alert.alert("Error", "Failed to get route to drop location.")
    }
  }

  const handleEndTrip = () => {
    Alert.alert(
      "End Trip",
      "Are you sure you want to end the trip?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Trip",
          style: "destructive",
          onPress: () => {
            closeMapModal()
            onClose()
          },
        },
      ]
    )
  }

  useEffect(() => {
    // Only ensure coordinates when we actually need them for the map or when explicitly requested
    // Don't run this when coordinates are null and user hasn't opened the map
    if (tripData?.pickupLocation || tripData?.dropLocation) {
      // Only run geocoding if:
      // 1. We don't have database coordinates, OR
      // 2. User has opened the map modal
      const hasDatabaseCoords = tripData?.pickupLatitude && tripData?.dropLatitude
      const shouldGeocode = !hasDatabaseCoords || showMapModal

      if (shouldGeocode) {
        console.log("Trip data available, ensuring coordinates", {
          pickupLocation: tripData?.pickupLocation,
          dropLocation: tripData?.dropLocation,
          pickupLatitude: tripData?.pickupLatitude,
          dropLatitude: tripData?.dropLatitude,
          hasDatabaseCoords,
          showMapModal,
        })

        // Debounce geocoding to prevent rapid successive calls
        const timeoutId = setTimeout(() => {
          ensurePickupDropCoordinates()
        }, 500) // 500ms debounce

        return () => clearTimeout(timeoutId)
      }
    }
  }, [ensurePickupDropCoordinates, tripData, showMapModal])

  const getAssignedCab = async (): Promise<void> => {
    try {
      setLoading(true)
      const token = await AsyncStorage.getItem("userToken")

      if (token) {
        const cabResponse = await axios.get(`${API_BASE_URL}/api/assignCab/driver?ts=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
        })

        if (cabResponse.data && cabResponse.data.length > 0) {
          setCabNumber(cabResponse.data[0].CabsDetail.cabNumber || "")
          if (cabResponse.data[0].driverId) {
            setDriverId(cabResponse.data[0].driverId.toString())
          }
        }

        const tripResponse = await axios.get(`${API_BASE_URL}/api/assignCab/driver/getassgnedcab?ts=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
        })

        console.log("Trip Response:", tripResponse.data)

        if (tripResponse.data && tripResponse.data.assignment && tripResponse.data.assignment.length > 0) {
          const assignmentData = tripResponse.data.assignment[0]

          const pickupLatitude = assignmentData.pickupLatitude ?? assignmentData.CabAssignment?.pickupLatitude ?? null
          const pickupLongitude = assignmentData.pickupLongitude ?? assignmentData.CabAssignment?.pickupLongitude ?? null
          const dropLatitude = assignmentData.dropLatitude ?? assignmentData.CabAssignment?.dropLatitude ?? null
          const dropLongitude = assignmentData.dropLongitude ?? assignmentData.CabAssignment?.dropLongitude ?? null

          setTripData({
            customerName: assignmentData.customerName,
            customerPhone: assignmentData.customerPhone,
            pickupLocation: assignmentData.pickupLocation,
            dropLocation: assignmentData.dropLocation,
            tripType: assignmentData.tripType,
            vehicleType: assignmentData.vehicleType,
            duration: assignmentData.duration,
            estimatedDistance: assignmentData.estimatedDistance,
            estimatedFare: assignmentData.estimatedFare,
            actualFare: assignmentData.actualFare,
            scheduledPickupTime: assignmentData.scheduledPickupTime,
            actualPickupTime: assignmentData.actualPickupTime,
            dropTime: assignmentData.dropTime,
            specialInstructions: assignmentData.specialInstructions,
            adminNotes: assignmentData.adminNotes,
            id: assignmentData.id ?? assignmentData.CabAssignmentId ?? null,
            driverId: assignmentData.driverId ?? assignmentData.DriverId ?? null,
            pickupLatitude,
            pickupLongitude,
            dropLatitude,
            dropLongitude,
          })

          if (pickupLatitude && pickupLongitude) {
            const pickup: LocationCoords = {
              latitude: Number(pickupLatitude),
              longitude: Number(pickupLongitude),
            }
            setPickupCoords(pickup)
            console.log("Assigned pickup coords from API", pickup)
            // WebSocket will connect automatically when database coordinates are available

            const drop: LocationCoords = {
              latitude: Number(dropLatitude),
              longitude: Number(dropLongitude),
            }
            setDropCoords(drop)
            console.log("Assigned drop coords from API", drop)
            // WebSocket will connect automatically when database coordinates are available
          }
        }
      }
    } catch (error) {
      console.log("Error fetching assigned cab data:", error)
      Alert.alert("Error", "Failed to fetch trip details. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Auto-fit map to the current polyline (debounced)
  const lastFitRef = useRef<string>("")
  useEffect(() => {
    const fitKey = `${polylineCoords.length}-${currentLocation?.latitude}-${isTrackerZoomed}`
    if (fitKey === lastFitRef.current) return
    lastFitRef.current = fitKey

    if (isTrackerZoomed) {
      return
    }

    const timer = setTimeout(() => {
      try {
        if (mapRef.current && polylineCoords.length >= 2) {
          mapRef.current.fitToCoordinates(polylineCoords, {
            edgePadding: MAP_EDGE_PADDING,
            animated: true,
          })
        } else if (mapRef.current && currentLocation) {
          mapRef.current.animateToRegion(
            {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            },
            800,
          )
        }
      } catch (e) {
        console.log("fitToCoordinates error:", e)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [polylineCoords, currentLocation, isTrackerZoomed])

  // Ensure location permission and auto-route when map opens (run once)
  const hasAutoRouted = useRef(false)
  useEffect(() => {
    if (!showMapModal) {
      hasAutoRouted.current = false
      return
    }

    if (hasAutoRouted.current) return
    hasAutoRouted.current = true

    // Show loading immediately
    setMapLoading(true)

    requestLocationPermission()

    const timer = setTimeout(async () => {
      try {
        if (currentLocation && pickupCoords) {
          console.log("Auto-routing driver->pickup")
          setMapMode("toPickup")
          // Set immediate route for visual feedback
          setPolylineCoords([currentLocation, pickupCoords])

          const routeResult = await getDirections(currentLocation, pickupCoords)
          console.log("Auto-route got directions", routeResult.coordinates.length)
          applyRouteResult(routeResult, { preserveZoom: isTrackerZoomed })
        }
      } catch (err) {
        console.log("Auto-route error:", err)
      } finally {
        setMapLoading(false)
      }
    }, 500) // Reduced from 1000ms to 500ms for faster response

    return () => clearTimeout(timer)
  }, [showMapModal, currentLocation, pickupCoords, applyRouteResult, isTrackerZoomed])

  // Fallback: draw straight line if pickup & drop exist but no polyline yet
  useEffect(() => {
    if (pickupCoords && dropCoords && polylineCoords.length === 0 && showMapModal && mapMode === "pickupToDrop") {
      applySimpleRoute([pickupCoords, dropCoords], { preserveZoom: isTrackerZoomed })
    }
  }, [pickupCoords, dropCoords, polylineCoords.length, showMapModal, mapMode, applySimpleRoute, isTrackerZoomed])

  // Fallback: driver to pickup when polyline empty
  useEffect(() => {
    if (polylineCoords.length === 0 && currentLocation && pickupCoords && showMapModal && mapMode === "toPickup") {
      applySimpleRoute([currentLocation, pickupCoords], { preserveZoom: isTrackerZoomed })
    }
  }, [polylineCoords.length, currentLocation, pickupCoords, showMapModal, mapMode, applySimpleRoute, isTrackerZoomed])




  const getMapRegion = () => {
    if (mapMode === "toPickup" && currentLocation && pickupCoords) {
      const midLat = (currentLocation.latitude + pickupCoords.latitude) / 2
      const midLng = (currentLocation.longitude + pickupCoords.longitude) / 2
      const latDelta = Math.abs(currentLocation.latitude - pickupCoords.latitude) * 1.5
      const lngDelta = Math.abs(currentLocation.longitude - pickupCoords.longitude) * 1.5

      return {
        latitude: midLat,
        longitude: midLng,
        latitudeDelta: Math.max(latDelta, 0.01),
        longitudeDelta: Math.max(lngDelta, 0.01),
      }
    } else if (mapMode === "toPickup" && currentLocation) {
      return {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      }
    } else if (pickupCoords && dropCoords) {
      const midLat = (pickupCoords.latitude + dropCoords.latitude) / 2
      const midLng = (pickupCoords.longitude + dropCoords.longitude) / 2
      const latDelta = Math.abs(pickupCoords.latitude - dropCoords.latitude) * 1.3
      const lngDelta = Math.abs(pickupCoords.longitude - dropCoords.longitude) * 1.3

      return {
        latitude: midLat,
        longitude: midLng,
        latitudeDelta: Math.max(latDelta, 0.05),
        longitudeDelta: Math.max(lngDelta, 0.05),
      }
    } else if (pickupCoords) {
      return {
        latitude: pickupCoords.latitude,
        longitude: pickupCoords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    }

    if (currentLocation) {
      return {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    }

    return {
      latitude: 19.076,
      longitude: 72.8777,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    }
  }

  const loadViewerIdentifier = useCallback(async () => {
    try {
      const storedViewer = await AsyncStorage.getItem("viewerId")
      if (storedViewer) {
        setViewerId(storedViewer)
        return
      }

      const baseUser = (await AsyncStorage.getItem("userid")) ?? `viewer-${Date.now()}`
      const viewerIdentifier = `viewer-${baseUser}`
      await AsyncStorage.setItem("viewerId", viewerIdentifier)
      setViewerId(viewerIdentifier)
    } catch (error) {
      console.log("Error loading viewer identifier:", error)
    }
  }, [])

  const cleanupSocket = useCallback(() => {
    // Clear any pending reconnection
    if (reconnectTimeoutRef.current.timeout) {
      clearTimeout(reconnectTimeoutRef.current.timeout)
      reconnectTimeoutRef.current.timeout = null
    }
    // Clear heartbeat timer
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    // Close existing WebSocket connection
    if (websocketRef.current) {
      // Remove event listeners to prevent memory leaks
      websocketRef.current.onclose = null
      websocketRef.current.onerror = null
      websocketRef.current.onmessage = null

      // Close if still open or connecting
      if (websocketRef.current.readyState === WebSocket.OPEN ||
          websocketRef.current.readyState === WebSocket.CONNECTING) {
        websocketRef.current.close(1000, "Component cleanup")
      }
      websocketRef.current = null
    }

    setIsSocketConnected(false)
  }, [])

  const handleDriverUpdate = useCallback(
    async (payload: {
      location: {
        latitude: number
        longitude: number
        pickup?: LocationCoords | null
        drop?: LocationCoords | null
        phase?: TripPhase
      }
    }) => {
      try {
        const { location } = payload
        const driverPoint: LocationCoords = {
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
        }
        // Calculate and update car rotation
        if (prevLocationRef.current) {
          const rotation = calculateCarRotation(prevLocationRef.current, driverPoint)
          setCarRotation(rotation)
        }
        prevLocationRef.current = driverPoint

        setCurrentLocation(driverPoint)
        updateGuidanceProgress(driverPoint)

        // Check if driver reached pickup location (within 50 meters)
        if (pickupCoords && tripPhase === "to_pickup" && !showStartTripButton) {
          const distanceToPickup = calculateDistance(driverPoint, pickupCoords)
          if (distanceToPickup <= 100) {
            setShowStartTripButton(true)
            setTripPhase("pickup_reached")
          }
        }

        // Check if driver reached drop location (within 50 meters)
        if (dropCoords && tripPhase === "to_drop" && !showEndTripButton) {
          const distanceToDrop = calculateDistance(driverPoint, dropCoords)
          if (distanceToDrop <= 50) {
            setShowEndTripButton(true)
            setTripPhase("completed")
          }
        }

        if (location.pickup?.latitude && location.pickup?.longitude) {
          setPickupCoords({
            latitude: Number(location.pickup.latitude),
            longitude: Number(location.pickup.longitude),
          })
        }

        if (location.drop?.latitude && location.drop?.longitude) {
          setDropCoords({
            latitude: Number(location.drop.latitude),
            longitude: Number(location.drop.longitude),
          })
        }

        if (location.phase) {
          setTripPhase(location.phase)
        }

        if (!pendingRouteRef.current) {
          if (location.phase === "to_pickup" && location.pickup) {
            pendingRouteRef.current = {
              origin: driverPoint,
              destination: {
                latitude: Number(location.pickup.latitude),
                longitude: Number(location.pickup.longitude),
              },
            }
          } else if (location.phase === "to_drop" && location.drop) {
            pendingRouteRef.current = {
              origin: driverPoint,
              destination: {
                latitude: Number(location.drop.latitude),
                longitude: Number(location.drop.longitude),
              },
            }
          }
        } else {
          pendingRouteRef.current = {
            origin: driverPoint,
            destination: pendingRouteRef.current.destination,
          }
        }

        if (pendingRouteRef.current) {
          const routeResult = await getDirections(
            pendingRouteRef.current.origin,
            pendingRouteRef.current.destination,
          )
          applyRouteResult(routeResult, { preserveZoom: isTrackerZoomed })
          updateGuidanceProgress(driverPoint, routeResult.steps)
          pendingRouteRef.current = {
            origin: driverPoint,
            destination: pendingRouteRef.current.destination,
          }
        }
      } catch (error) {
        console.log("Error handling driver update:", error)
      }
    },
    [
      getDirections,
      pickupCoords,
      dropCoords,
      tripPhase,
      showStartTripButton,
      showEndTripButton,
      applyRouteResult,
      isTrackerZoomed,
      updateGuidanceProgress,
    ],
  )

  

  // Calculate car rotation based on movement direction
  const calculateCarRotation = (prevLoc: LocationCoords, newLoc: LocationCoords): number => {
    const deltaLat = newLoc.latitude - prevLoc.latitude
    const deltaLng = newLoc.longitude - prevLoc.longitude
    const angle = Math.atan2(deltaLng, deltaLat) * (180 / Math.PI)
    return angle
  }

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (loc1: LocationCoords, loc2: LocationCoords): number => {
    const R = 6371 // Earth's radius in km
    const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180
    const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(loc1.latitude * Math.PI / 180) * Math.cos(loc2.latitude * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c * 1000 // Return distance in meters
  }

  // Build route from live driver update even if phase is idle/unknown
  const updateRouteFromLive = async (live: any) => {
  try {
    const driverPoint: LocationCoords = {
      latitude: Number(live?.latitude),
      longitude: Number(live?.longitude),
    }

    const hasPickup = Boolean(live?.pickup?.latitude && live?.pickup?.longitude) || Boolean(pickupCoords)
    const hasDrop = Boolean(live?.drop?.latitude && live?.drop?.longitude) || Boolean(dropCoords)

    let effectivePhase: TripPhase | null = null
    if (live?.phase === 'to_pickup' || live?.phase === 'to_drop') {
      effectivePhase = live.phase
    } else if (hasPickup) {
      effectivePhase = 'to_pickup'
    }

    if (effectivePhase) { 
      setTripPhase(effectivePhase)
      if (effectivePhase === "to_drop") {
        setMapMode("pickupToDrop")
        setShowStartTripButton(false)
      } else if (effectivePhase === "to_pickup") {
        setMapMode("toPickup")
      }
    }

    let destination: LocationCoords | null = null
    if (effectivePhase === 'to_drop' && (live?.drop || dropCoords)) {
      destination = live?.drop ? { latitude: Number(live.drop.latitude), longitude: Number(live.drop.longitude) } : (dropCoords as LocationCoords)
    } else if (effectivePhase === 'to_pickup' && (live?.pickup || pickupCoords)) {
      destination = live?.pickup ? { latitude: Number(live.pickup.latitude), longitude: Number(live.pickup.longitude) } : (pickupCoords as LocationCoords)
    }

    // If we still don't have a destination, try to ensure coordinates from addresses
    if (!destination) {
      try {
        const ensured = await ensurePickupDropCoordinates()
        if (ensured) {
          destination = effectivePhase === 'to_drop' ? ensured.drop : ensured.pickup
        }
      } catch (_) {}
    }

    if (driverPoint && destination) {
      console.log('updateRouteFromLive target', { driverPoint, destination, phase: effectivePhase })
      const directions = await getDirections(driverPoint, destination)
      console.log('updateRouteFromLive polyline points', directions ? directions.coordinates.length : 0)
      if (directions && directions.coordinates.length > 0) {
        setPolylineCoords(directions.coordinates)
      } else {
        setPolylineCoords([driverPoint, destination])
      }
    }
  } catch (e) {
    console.log('updateRouteFromLive error:', e)
  }
}

const connectSocket = useCallback(() => {
    console.log("🚀 connectSocket called with:", {
      viewerId: !!viewerId,
      driverId: !!driverId,
      currentConnection: websocketRef.current?.readyState,
      isSocketConnected,
    })

    if (!viewerId || !driverId) {
      console.log("❌ connectSocket: Missing viewerId or driverId")
      return
    }

    // Prevent multiple simultaneous connection attempts
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.CONNECTING) {
      console.log("WebSocket already connecting, skipping...")
      return
    }

    // Don't connect if already connected and working
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN && isSocketConnected) {
      console.log("WebSocket already connected and working, skipping...")
      return
    }

    // Only cleanup if existing socket is closing/closed
    if (websocketRef.current && (websocketRef.current.readyState === WebSocket.CLOSING || websocketRef.current.readyState === WebSocket.CLOSED)) {
      cleanupSocket();
    }

    console.log("Attempting WebSocket connection to:", WS_BASE_URL)
    const ws = new WebSocket(WS_BASE_URL)
    websocketRef.current = ws

    ws.onopen = () => {
      console.log("✅ WebSocket connected successfully to", WS_BASE_URL)
      setIsSocketConnected(true)
      // Reset reconnect backoff and start heartbeat
      reconnectTimeoutRef.current.retryCount = 0;
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); }
      heartbeatRef.current = setInterval(() => {
        try {
          if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
            websocketRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        } catch (e) {}
      }, 25000)
      ws.send(
        JSON.stringify({
          type: "register",
          role: "viewer",
          viewerId,
          trackDriverId: driverId,
        }),
      )
    }

    ws.onmessage = (event) => {
      try {
        console.log("📨 Customer received raw message:", event.data);
        const data = JSON.parse(event.data);
        if (data.type === "pong") { return }
        console.log("📨 Customer parsed message:", data);

        if (data.type === "location_update" && data.location) {
          console.log("📍 Processing location update:", data);
          handleDriverUpdate(data);
          updateRouteFromLive(data.location);
          // force-fit fallback after live
          setTimeout(() => {
            try {
              if (polylineCoords.length === 0) {
                const src = currentLocation || null
                const pk = pickupCoords || null
                const dp = dropCoords || null
                let pair = null as any
                if (src && pk) pair = [src, pk]
                else if (pk && dp) pair = [pk, dp]
                else if (src && dp) pair = [src, dp]
                if (pair) {
                  setPolylineCoords(pair)
                  if (mapRef.current) {
                    mapRef.current.fitToCoordinates(pair, {
                      edgePadding: { top: 80, right: 80, bottom: 120, left: 80 },
                      animated: true,
                    })
                  }
                }
              }
            } catch (e) { console.log('force-fit fallback error', e) }
          }, 200);
        } else if (data.type === "register_confirmation") {
          console.log("✅ Customer registration confirmed:", data.message);
        } else {
          console.log("❓ Unknown message type:", data.type);
        }
      } catch (error) {
        console.log("❌ Error parsing customer websocket message:", error);
      }
    }

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason)
      setIsSocketConnected(false)
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }

      // Only reconnect if we have valid IDs and connection wasn't closed intentionally
      if (!viewerId || !driverId || event.code === 1000) {
        console.log("WebSocket closed intentionally or missing IDs, not reconnecting")
        return
      }

      // Exponential backoff with max retry attempts
      const retryCount = reconnectTimeoutRef.current.retryCount
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000) // Max 30 seconds

      console.log(`Scheduling reconnection attempt ${retryCount + 1} in ${delay}ms`)

      reconnectTimeoutRef.current.timeout = setTimeout(() => {
        reconnectTimeoutRef.current.timeout = null
        if (retryCount < 10) { // Max 10 retry attempts
          reconnectTimeoutRef.current.retryCount = retryCount + 1
          connectSocket()
        } else {
          console.log("Max reconnection attempts reached")
        }
      }, delay)
    }

    ws.onerror = (error) => {
      console.log("WebSocket error:", error)
    }
  }, [cleanupSocket, driverId, handleDriverUpdate, viewerId, isSocketConnected])

  useEffect(() => {
    const hasDatabaseCoords = Boolean(tripData?.pickupLatitude && tripData?.dropLatitude)
    const hasResolvedCoords = hasDatabaseCoords || Boolean(pickupCoords && dropCoords)
    const userRequestedTracking = showMapModal

    console.log("WebSocket connection check:", {
      viewerId: !!viewerId,
      driverId: !!driverId,
      hasDatabaseCoords,
      hasResolvedCoords,
      userRequestedTracking,
      tripDataCoords: {
        pickupLatitude: tripData?.pickupLatitude,
        dropLatitude: tripData?.dropLatitude,
      },
      shouldConnect: viewerId && driverId && (hasResolvedCoords || userRequestedTracking),
    })

    if (viewerId && driverId && (hasResolvedCoords || userRequestedTracking)) {
      console.log("🔗 Connecting WebSocket due to:", {
        hasDatabaseCoords,
        hasResolvedCoords,
        userRequestedTracking,
      })
      connectSocket()
    }

    return () => {}
  }, [cleanupSocket, connectSocket, driverId, viewerId, tripData?.pickupLatitude, tripData?.dropLatitude, pickupCoords, dropCoords, showMapModal])

  useEffect(() => {
    if (mapRef.current && currentLocation && mapMode === "toPickup") {
      mapRef.current.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        750,
      )
    }
  }, [currentLocation, mapMode])

  useEffect(() => {
    if (mapRef.current && pickupCoords && dropCoords && mapMode === "pickupToDrop") {
      const midLat = (pickupCoords.latitude + dropCoords.latitude) / 2
      const midLng = (pickupCoords.longitude + dropCoords.longitude) / 2
      const latDelta = Math.abs(pickupCoords.latitude - dropCoords.latitude) * 1.3 || 0.08
      const lngDelta = Math.abs(pickupCoords.longitude - dropCoords.longitude) * 1.3 || 0.08

      mapRef.current.animateToRegion(
        {
          latitude: midLat,
          longitude: midLng,
          latitudeDelta: Math.max(latDelta, 0.02),
          longitudeDelta: Math.max(lngDelta, 0.02),
        },
        750,
      )
    }
  }, [dropCoords, mapMode, pickupCoords])

  const tripPhaseLabel = useMemo(() => {
    switch (tripPhase) {
      case "to_pickup":
        return "Driver en route to pickup"
      case "pickup_reached":
        return "Driver at pickup point"
      case "to_drop":
        return "Driver en route to drop"
      case "completed":
        return "Trip completed"
      default:
        return isSocketConnected ? "Live tracking active" : "Connecting to driver"
    }
  }, [isSocketConnected, tripPhase])

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={styles.loadingText}>Loading trip details...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.contentContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={true}
          scrollEventThrottle={16}
        >
          {/* Trip Details Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="route" size={18} color="#F59E0B" />
              <Text style={styles.cardTitle}>Trip Details</Text>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <MaterialIcons name="my-location" size={16} color="#10b981" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Pickup Location</Text>
                  <Text style={styles.infoValue}>{tripData?.pickupLocation || "Not set"}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <MaterialIcons name="location-on" size={16} color="#ef4444" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Drop Location</Text>
                  <Text style={styles.infoValue}>{tripData?.dropLocation || "Not set"}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <MaterialIcons name="category" size={16} color="#92400E" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Trip Type</Text>
                  <Text style={styles.infoValue}>{tripData?.tripType || "Not specified"}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <MaterialIcons name="directions-car" size={16} color="#92400E" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Vehicle Type</Text>
                  <Text style={styles.infoValue}>{tripData?.vehicleType || "Not specified"}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <MaterialIcons name="schedule" size={16} color="#92400E" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Duration</Text>
                  <Text style={styles.infoValue}>{tripData?.duration || "Not calculated"}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <MaterialIcons name="straighten" size={16} color="#92400E" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Estimated Distance</Text>
                  <Text style={styles.infoValue}>{tripData?.estimatedDistance || "Not calculated"}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Coordinate Debug Display */}
          {(tripData?.pickupLocation || tripData?.dropLocation || pickupCoords || dropCoords || currentLocation) && (
            <View style={styles.debugCard}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="location-searching" size={18} color="#F59E0B" />
                <Text style={styles.cardTitle}>📍 Live Tracking Debug</Text>
              </View>

              {/* Connection Status */}
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>WebSocket Status:</Text>
                <Text style={[styles.debugValue, { color: isSocketConnected ? "#10b981" : "#ef4444" }]}>
                  {(() => {
                    const wsState = websocketRef.current?.readyState
                    if (wsState === WebSocket.CONNECTING) return "🟡 Connecting..."
                    if (wsState === WebSocket.OPEN && isSocketConnected) return "🟢 Connected"
                    if (wsState === WebSocket.CLOSED) return "🔴 Disconnected"
                    if (wsState === WebSocket.CLOSING) return "🟠 Closing..."
                    return "⚫ Unknown"
                  })()}
                </Text>
              </View>

              {/* Connection Details */}
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Connection State:</Text>
                <Text style={styles.debugValue}>
                  {websocketRef.current
                    ? websocketRef.current.readyState === WebSocket.CONNECTING
                      ? "CONNECTING"
                      : websocketRef.current.readyState === WebSocket.OPEN
                      ? "OPEN"
                      : websocketRef.current.readyState === WebSocket.CLOSING
                      ? "CLOSING"
                      : "CLOSED"
                    : "NO_CONNECTION"}
                </Text>
              </View>

              {/* Reconnection Info */}
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Retry Count:</Text>
                <Text style={styles.debugValue}>
                  {reconnectTimeoutRef.current.retryCount}
                </Text>
              </View>

              {/* Trip Phase */}
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Trip Phase:</Text>
                <Text style={styles.debugValue}>{tripPhaseLabel}</Text>
              </View>

              {/* Database Coordinates */}
              {tripData && (
                <>
                  <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>Pickup (DB):</Text>
                    <Text style={styles.debugValue}>
                      {tripData.pickupLatitude && tripData.pickupLongitude
                        ? `${tripData.pickupLatitude.toFixed(6)}, ${tripData.pickupLongitude.toFixed(6)}`
                        : "❌ Waiting for driver to submit coordinates"}
                    </Text>
                  </View>

                  <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>Drop (DB):</Text>
                    <Text style={styles.debugValue}>
                      {tripData.dropLatitude && tripData.dropLongitude
                        ? `${tripData.dropLatitude.toFixed(6)}, ${tripData.dropLongitude.toFixed(6)}`
                        : "❌ Waiting for driver to submit coordinates"}
                    </Text>
                  </View>
                </>
              )}

              {/* Resolved Coordinates */}
              {pickupCoords && (
                <View style={styles.debugRow}>
                  <Text style={styles.debugLabel}>Pickup (Map):</Text>
                  <Text style={styles.debugValue}>
                    {pickupCoords.latitude.toFixed(6)}, {pickupCoords.longitude.toFixed(6)}
                  </Text>
                </View>
              )}

              {dropCoords && (
                <View style={styles.debugRow}>
                  <Text style={styles.debugLabel}>Drop (Map):</Text>
                  <Text style={styles.debugValue}>
                    {dropCoords.latitude.toFixed(6)}, {dropCoords.longitude.toFixed(6)}
                  </Text>
                </View>
              )}

              {/* Current Driver Location */}
              {currentLocation && (
                <View style={styles.debugRow}>
                  <Text style={styles.debugLabel}>Driver Location:</Text>
                  <Text style={styles.debugValue}>
                    {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                  </Text>
                </View>
              )}

              {/* Map Mode */}
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Map Mode:</Text>
                <Text style={styles.debugValue}>{mapMode}</Text>
              </View>

              {/* Polyline Points */}
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Route Points:</Text>
                <Text style={styles.debugValue}>{polylineCoords.length}</Text>
              </View>

              {/* Manual Reconnect Button */}
              <View style={styles.debugActionRow}>
                <TouchableOpacity
                  style={styles.reconnectButton}
                  onPress={() => {
                    console.log("Manual reconnect triggered")
                    reconnectTimeoutRef.current.retryCount = 0 // Reset retry count
                    connectSocket()
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="refresh" size={16} color="#F59E0B" />
                  <Text style={styles.reconnectText}>Reconnect</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={() => {
                    console.log("Manual refresh triggered")
                    getAssignedCab()
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="sync" size={16} color="#10b981" />
                  <Text style={styles.refreshText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Coordinate Status Information */}
          {tripData && (!tripData.pickupLatitude || !tripData.dropLatitude) && !(pickupCoords && dropCoords) && (
            <View style={styles.infoCard}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="info-outline" size={18} color="#F59E0B" />
                <Text style={styles.cardTitle}>Coordinate Status</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons name="schedule" size={16} color="#F59E0B" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoValue}>
                    Driver needs to submit pickup and drop coordinates before live tracking can begin.
                    Please wait for the driver to complete their location submission.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={getAssignedCab}
                activeOpacity={0.8}
              >
                <MaterialIcons name="refresh" size={16} color="#ffffff" />
                <Text style={styles.refreshButtonText}>Check for Updates</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="info" size={18} color="#F59E0B" />
                <Text style={styles.cardTitle}>Additional Information</Text>
              </View>

              {tripData?.specialInstructions && (
                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <MaterialIcons name="note" size={16} color="#F59E0B" />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Special Instructions</Text>
                      <Text style={styles.infoValue}>{tripData.specialInstructions}</Text>
                    </View>
                  </View>
                </View>
              )}

              {tripData?.adminNotes && (
                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <MaterialIcons name="admin-panel-settings" size={16} color="#8b5cf6" />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Admin Notes</Text>
                      <Text style={styles.infoValue}>{tripData.adminNotes}</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          

          {/* No Trip Data Message */}
          {!tripData?.pickupLocation && (
            <View style={styles.noDataCard}>
              <MaterialIcons name="info-outline" size={24} color="#92400E" />
              <Text style={styles.noDataTitle}>No Active Trip</Text>
              <Text style={styles.noDataText}>
                No trip details are currently available. Trip information will appear here once a ride is
                assigned.
              </Text>
            </View>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </Animated.View>

      {/* Fixed Track Location Button */}
      {tripData?.pickupLocation && tripData?.dropLocation && (
        <View style={styles.fixedButtonContainer}>
          <TouchableOpacity style={styles.trackButton} onPress={handleTrackLocation} activeOpacity={0.8}>
            <MaterialIcons name="location-on" size={20} color="#ffffff" />
            <Text style={styles.trackButtonText}>Navigation</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map Modal */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        transparent={false}
        onRequestClose={closeMapModal}
      >
        <View style={styles.mapContainer}>
          <View style={styles.mapHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={closeMapModal}>
              <MaterialIcons name="close" size={24} color="#1f2937" />
            </TouchableOpacity>
            <Text style={styles.mapHeaderTitle}>Trip Route</Text>
            <View style={styles.headerSpacer} />
          </View>

          {mapLoading && (
            <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator size="large" color="#F59E0B" />
              <Text style={styles.mapLoadingText}>Loading route...</Text>
            </View>
          )}

          <MapView
            key={`map-${polylineCoords.length}-${currentLocation?.latitude || 0}`}
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={getMapRegion()}
            showsUserLocation={true}
            showsMyLocationButton={true}
            showsTraffic={false}
            showsBuildings={false}
            showsIndoors={false}
            loadingEnabled={true}
            loadingIndicatorColor="#F59E0B"
            zoomEnabled={true}
            scrollEnabled={true}
            rotateEnabled={true}
            pitchEnabled={true}
            onLayout={() => console.log('Map layout complete')}
            onMapReady={() => {
              console.log("✅ Map is ready - polyline points:", polylineCoords.length)
              if (Platform.OS === "android") {
                requestLocationPermission()
              }
            }}
            customMapStyle={[
              {
                featureType: "poi.business",
                stylers: [{ visibility: "off" }],
              },
              {
                featureType: "poi.park",
                elementType: "labels.text",
                stylers: [{ visibility: "off" }],
              },
              {
                featureType: "road.local",
                elementType: "labels.text",
                stylers: [{ visibility: "off" }],
              },
              {
                featureType: "road.arterial",
                elementType: "labels.text",
                stylers: [{ visibility: "simplified" }],
              },
              {
                featureType: "road.highway",
                elementType: "labels.text",
                stylers: [{ visibility: "simplified" }],
              },
              {
                featureType: "transit",
                stylers: [{ visibility: "off" }],
              },
              {
                featureType: "water",
                elementType: "geometry.fill",
                stylers: [{ color: "#74b9ff" }],
              },
              {
                featureType: "landscape.natural",
                elementType: "geometry.fill",
                stylers: [{ color: "#dcedc8" }],
              },
              {
                featureType: "road",
                elementType: "geometry.fill",
                stylers: [{ color: "#ffffff" }],
              },
              {
                featureType: "road",
                elementType: "geometry.stroke",
                stylers: [{ color: "#e0e0e0" }, { weight: 0.5 }],
              },
            ]}
          >
            {/* Car Marker with Rotation */}
            {currentLocation && (
            <Marker
            coordinate={currentLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={carRotation}
            flat={true}
            title="Driver"
            description="Moving to destination"
          >
            <Image
              source={require("../assets/car_maker.png")}
              style={[
                styles.carMarkerImage,
                { transform: [{ rotate: `${carRotation}deg` }] },
              ]}
            />
          </Marker>
            )}

            {mapMode === "toPickup" && pickupCoords && (
              <Marker
                tracksViewChanges={false}
                coordinate={pickupCoords}
                title="Pickup Location"
                description={tripData?.pickupLocation || ""}
                pinColor="green"
              />
            )}

            {mapMode === "pickupToDrop" && dropCoords && (
              <Marker
                tracksViewChanges={false}
                coordinate={dropCoords}
                title="Drop Location"
                description={tripData?.dropLocation || ""}
                pinColor="red"
              />
            )}

            {/* Enhanced Polyline with Border Effect */}
            {polylineCoords.length >= 2 && (
              <Polyline
                coordinates={polylineCoords}
                strokeColor={SKY_BLUE}
                strokeWidth={6}
                lineCap="round"
                lineJoin="round"
                zIndex={999}
              />
            )}
          </MapView>

          {/* Overlay Buttons */}
          <View style={styles.overlayButtonsContainer}>
            <TouchableOpacity style={styles.zoomToggleButton} onPress={toggleTrackerZoom} activeOpacity={0.8}>
              <MaterialIcons name={isTrackerZoomed ? "zoom-out-map" : "zoom-in-map"} size={22} color="#1f2937" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={() => mapRef.current?.fitToCoordinates(polylineCoords, { edgePadding: MAP_EDGE_PADDING, animated: true })} activeOpacity={0.8}>
              <MaterialIcons name="center-focus-strong" size={20} color="#1f2937" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={() => {
              if (mapRef.current && currentLocation) {
                mapRef.current.animateCamera({ center: currentLocation, zoom: 18, pitch: 0, heading: 0 }, { duration: 600 })
              }
            }} activeOpacity={0.8}>
              <MaterialIcons name="zoom-in" size={20} color="#1f2937" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={() => {
              if (mapRef.current && currentLocation) {
                mapRef.current.animateCamera({ center: currentLocation, zoom: 14, pitch: 0, heading: 0 }, { duration: 600 })
              }
            }} activeOpacity={0.8}>
              <MaterialIcons name="zoom-out" size={20} color="#1f2937" />
            </TouchableOpacity>

            {showStartTripButton && (
              <TouchableOpacity style={styles.startTripButton} onPress={handleStartTrip} activeOpacity={0.8}>
                <MaterialIcons name="directions-run" size={20} color="#ffffff" />
                <Text style={styles.startTripButtonText}>Start Trip</Text>
              </TouchableOpacity>
            )}

            {showEndTripButton && (
              <TouchableOpacity style={styles.endTripButton} onPress={handleEndTrip} activeOpacity={0.8}>
                <MaterialIcons name="flag" size={20} color="#ffffff" />
                <Text style={styles.endTripButtonText}>End Trip</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.tripInfoOverlay}>
            <View style={styles.tripInfoCard}>
              {shouldShowGuidance ? (
                <View style={styles.guidanceRow}>
                  <MaterialIcons name={activeTurnIcon} size={22} color="#1f2937" style={styles.guidanceIcon} />
                  <View style={styles.guidanceContent}>
                    <Text style={styles.guidanceInstruction} numberOfLines={2}>
                      {guidanceTitle}
                    </Text>
                    {activeStepDistance !== "" && (
                      <Text style={styles.guidanceDistance}>{activeStepDistance}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.muteButton, { backgroundColor: ttsEnabled ? "#10b981" : "#ef4444" }]}
                    onPress={toggleTTS}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons
                      name={ttsEnabled ? "volume-up" : "volume-off"}
                      size={16}
                      color="#ffffff"
                    />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.guidancePlaceholder}>
                  <MaterialIcons name="navigation" size={18} color="#6b7280" />
                  <Text style={styles.guidancePlaceholderText}>Navigation ready</Text>
                </View>
              )}

              {mapMode === "toPickup" && (
                <>
                  <View style={styles.locationRow}>
                    <MaterialIcons name="my-location" size={16} color="#F59E0B" />
                    <Text style={styles.locationText} numberOfLines={1}>
                      Driver Location
                    </Text>
                  </View>
                  <View style={styles.locationDivider} />
                  <View style={styles.locationRow}>
                    <MaterialIcons name="location-on" size={16} color="#10b981" />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {tripData?.pickupLocation}
                    </Text>
                  </View>
                </>
              )}

              {mapMode === "pickupToDrop" && (
                <>
                  <View style={styles.locationRow}>
                    <MaterialIcons name="my-location" size={16} color="#10b981" />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {tripData?.pickupLocation}
                    </Text>
                  </View>
                  <View style={styles.locationDivider} />
                  <View style={styles.locationRow}>
                    <MaterialIcons name="location-on" size={16} color="#ef4444" />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {tripData?.dropLocation}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFBEB",
  },
  contentContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  bottomPadding: {
    height: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: "#92400E",
    fontWeight: "500",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#FEF3C7",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#92400E",
    marginLeft: 8,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    lineHeight: 20,
  },
  noDataCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  noDataTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#92400E",
    marginTop: 12,
    marginBottom: 8,
  },
  noDataText: {
    fontSize: 14,
    color: "#92400E",
    textAlign: "center",
    lineHeight: 20,
    opacity: 0.8,
  },
  fixedButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 2,
    borderTopColor: "#FEF3C7",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 12,
  },
  trackButton: {
    backgroundColor: "#F59E0B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  trackButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 8,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#FEF3C7",
    elevation: 4,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  closeButton: {
    padding: 10,
    borderRadius: 25,
    backgroundColor: "#FEF3C7",
  },
  mapHeaderTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#92400E",
    textAlign: "center",
  },
  headerSpacer: {
    width: 50,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mapLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  mapLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#92400E",
    fontWeight: "600",
  },
  currentLocationMarker: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  currentLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4285F4",
    borderWidth: 2,
    borderColor: "#ffffff",
    position: "absolute",
    zIndex: 2,
  },
  currentLocationPulse: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(66, 133, 244, 0.3)",
    position: "absolute",
    zIndex: 1,
  },
  pickupMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  dropMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  overlayButtonsContainer: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    zIndex: 1000,
    flexDirection: "column",
    alignItems: "flex-start",
  },
  zoomToggleButton: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 12,
    marginBottom: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  controlButton: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 10,
    marginBottom: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  startTripButton: {
    backgroundColor: "#10b981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignSelf: "center",
  },
  startTripButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 8,
  },
  endTripButton: {
    backgroundColor: "#ef4444",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignSelf: "center",
    marginTop: 12,
  },
  endTripButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 8,
  },
  tripInfoOverlay: {
    position: "absolute",
    top: 80,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  tripInfoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 12,
    borderWidth: 2,
    borderColor: "#FEF3C7",
  },
  guidanceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  guidanceIcon: {
    marginRight: 12,
  },
  guidanceContent: {
    flex: 1,
  },
  guidanceInstruction: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 2,
  },
  guidanceDistance: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  muteButton: {
    padding: 8,
    borderRadius: 16,
    marginLeft: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  guidancePlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    marginBottom: 12,
  },
  guidancePlaceholderText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  locationText: {
    flex: 1,
    marginLeft: 16,
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  locationDivider: {
    height: 2,
    backgroundColor: "#FEF3C7",
    marginHorizontal: 8,
    marginVertical: 4,
  },
  debugCard: {
    backgroundColor: "#FFF3E0",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: "#FFE0B2",
  },
  debugRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#FFE0B2",
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#BF360C",
    flex: 1,
  },
  debugValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3E2723",
    textAlign: "right",
    flex: 1,
  },
  debugActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#FFE0B2",
  },
  debugActionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E65100",
  },
  debugActionValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2E7D32",
    textAlign: "right",
    flex: 1,
  },
  reconnectButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  reconnectText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#F59E0B",
    marginLeft: 4,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#10b981",
    marginLeft: 8,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10b981",
    marginLeft: 4,
  },
  infoCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  refreshButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
    marginLeft: 4,
  },
  carMarkerImage: {
    width: 70,
    height: 90,
    resizeMode: "contain",
  },
})

export default CustomerDetailScreen