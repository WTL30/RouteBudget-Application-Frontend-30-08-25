"use client"

import type React from "react"
import { useEffect, useState, useRef } from "react"
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
  Linking, // Added Linking import for phone dialer functionality
} from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import axios from "react-native-axios"
import MaterialIcons from "react-native-vector-icons/MaterialIcons"
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from "react-native-maps"
import Geolocation from "@react-native-community/geolocation"

const { width, height } = Dimensions.get("window")

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
}

interface CustomerDetailScreenProps {
  onClose: () => void
}

interface LocationCoords {
  latitude: number
  longitude: number
}

type MapMode = "full" | "toPickup" | "pickupToDrop"

const CustomerDetailScreen: React.FC<CustomerDetailScreenProps> = ({ onClose }) => {
  const [cabNumber, setCabNumber] = useState<string>("")
  const [tripData, setTripData] = useState<TripData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [fadeAnim] = useState(new Animated.Value(0))
  const [slideAnim] = useState(new Animated.Value(20))

  // Map related states
  const [showMapModal, setShowMapModal] = useState<boolean>(false)
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null)
  const [pickupCoords, setPickupCoords] = useState<LocationCoords | null>(null)
  const [dropCoords, setDropCoords] = useState<LocationCoords | null>(null)
  const [mapLoading, setMapLoading] = useState<boolean>(false)
  const [polylineCoords, setPolylineCoords] = useState<LocationCoords[]>([])
  const [mapMode, setMapMode] = useState<MapMode>("full")
  const [watchId, setWatchId] = useState<number | null>(null)
  const mapRef = useRef<MapView | null>(null)

  useEffect(() => {
    const initializeScreen = async () => {
      await getAssignedCab()
      await requestLocationPermission()
      startAnimations()
    }
    initializeScreen()

    return () => {
      if (watchId !== null) {
        Geolocation.clearWatch(watchId)
      }
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
          timeout: 10000, // 10 seconds for high accuracy
          maximumAge: 10000, // Allow 10 second old location
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
            case 1: // PERMISSION_DENIED
              errorMessage += "Please enable location permissions in settings."
              break
            case 2: // POSITION_UNAVAILABLE
              errorMessage += "Location services are not available. Please check your GPS settings."
              break
            case 3: // TIMEOUT
              errorMessage += "Location request timed out. Please ensure you have a good GPS signal and try again."
              break
            default:
              errorMessage += "Please check your GPS settings and try again."
          }
          Alert.alert("Location Error", errorMessage)
        },
        {
          enableHighAccuracy: false, // Use network/wifi location
          timeout: 15000, // 15 seconds for low accuracy
          maximumAge: 30000, // Allow 30 second old location
        },
      )
    }

    // Start with high accuracy attempt
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
        enableHighAccuracy: false, // Use network location for continuous tracking
        timeout: 20000,
        maximumAge: 10000, // Allow 10 second old locations for tracking
        distanceFilter: 5,
      },
    )
    setWatchId(id)
  }

  const geocodeAddress = async (address: string): Promise<LocationCoords | null> => {
    try {
      const API_KEY = "AIzaSyAKjmBSUJ3XR8uD10vG2ptzqLJAZnOlzqI"
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`,
      )

      if (response.data.results && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location
        return {
          latitude: location.lat,
          longitude: location.lng,
        }
      }
      return null
    } catch (error) {
      console.log("Geocoding error:", error)
      return null
    }
  }

  const getDirections = async (origin: LocationCoords, destination: LocationCoords) => {
    try {
      const API_KEY = "AIzaSyAKjmBSUJ3XR8uD10vG2ptzqLJAZnOlzqI"
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${API_KEY}`,
      )

      if (response.data.routes && response.data.routes.length > 0) {
        const points = response.data.routes[0].overview_polyline.points
        return decodePolyline(points)
      }
      return []
    } catch (error) {
      console.log("Directions error:", error)
      return []
    }
  }

  const decodePolyline = (encoded: string): LocationCoords[] => {
    const poly = []
    let index = 0
    const len = encoded.length
    let lat = 0
    let lng = 0

    while (index < len) {
      let b,
        shift = 0,
        result = 0
      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      const dlat = (result & 1) != 0 ? ~(result >> 1) : result >> 1
      lat += dlat

      shift = 0
      result = 0
      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      const dlng = (result & 1) != 0 ? ~(result >> 1) : result >> 1
      lng += dlng

      poly.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      })
    }
    return poly
  }

  const handleTrackLocation = async () => {
    if (!tripData?.pickupLocation || !tripData?.dropLocation) {
      Alert.alert("Error", "Pickup and drop locations are required for tracking.")
      return
    }

    setMapLoading(true)
    setShowMapModal(true)
    setMapMode("full")

    try {
      const pickup = await geocodeAddress(tripData.pickupLocation)
      const drop = await geocodeAddress(tripData.dropLocation)

      if (pickup && drop) {
        setPickupCoords(pickup)
        setDropCoords(drop)
        const directions = await getDirections(pickup, drop)
        setPolylineCoords(directions)
      } else {
        Alert.alert("Error", "Could not find coordinates for the locations.")
      }
    } catch (error) {
      console.log("Track location error:", error)
      Alert.alert("Error", "Failed to load map data.")
    } finally {
      setMapLoading(false)
    }
  }

  const handleStartToPickup = async () => {
    setMapLoading(true)
    setMapMode("toPickup")
    setShowMapModal(true)

    try {
      // First request location permission and get current location
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ])

        if (
          granted["android.permission.ACCESS_FINE_LOCATION"] !== PermissionsAndroid.RESULTS.GRANTED ||
          granted["android.permission.ACCESS_COARSE_LOCATION"] !== PermissionsAndroid.RESULTS.GRANTED
        ) {
          Alert.alert("Permission Required", "Location permission is required to track your location.")
          setMapLoading(false)
          return
        }
      }

      const getCurrentLocationForPickup = () => {
        return new Promise((resolve, reject) => {
          // Try high accuracy first
          Geolocation.getCurrentPosition(
            (position) => {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              })
            },
            (error) => {
              console.log("High accuracy failed, trying low accuracy:", error)
              // Fallback to low accuracy
              Geolocation.getCurrentPosition(
                (position) => {
                  resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                  })
                },
                (fallbackError) => {
                  reject(fallbackError)
                },
                {
                  enableHighAccuracy: false,
                  timeout: 15000,
                  maximumAge: 30000,
                },
              )
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 10000,
            },
          )
        })
      }

      try {
        const userLocation = await getCurrentLocationForPickup()
        setCurrentLocation(userLocation)

        if (mapRef.current) {
          mapRef.current.animateToRegion(
            {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.004,
              longitudeDelta: 0.004,
            },
            1500,
          )
        }

        // Start location tracking with better configuration
        const watchId = Geolocation.watchPosition(
          (position) => {
            const newLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }
            setCurrentLocation(newLocation)

            if (mapRef.current && mapMode === "toPickup") {
              mapRef.current.animateToRegion(
                {
                  latitude: newLocation.latitude,
                  longitude: newLocation.longitude,
                  latitudeDelta: 0.004,
                  longitudeDelta: 0.004,
                },
                500,
              )
            }
          },
          (error) => {
            console.log("Location tracking error:", error)
          },
          {
            enableHighAccuracy: false, // Use network location for better reliability
            timeout: 20000,
            maximumAge: 10000, // Allow cached locations
            distanceFilter: 2,
          },
        )
        setWatchId(watchId)

        // Get pickup coordinates and directions
        if (tripData?.pickupLocation) {
          const pickup = await geocodeAddress(tripData.pickupLocation)
          if (pickup) {
            setPickupCoords(pickup)
            const directions = await getDirections(userLocation, pickup)
            setPolylineCoords(directions)

            if (mapRef.current) {
              const midLat = (userLocation.latitude + pickup.latitude) / 2
              const midLng = (userLocation.longitude + pickup.longitude) / 2
              const latDelta = Math.abs(userLocation.latitude - pickup.latitude) * 1.8
              const lngDelta = Math.abs(userLocation.longitude - pickup.longitude) * 1.8

              mapRef.current.animateToRegion(
                {
                  latitude: midLat,
                  longitude: midLng,
                  latitudeDelta: Math.max(latDelta, 0.01),
                  longitudeDelta: Math.max(lngDelta, 0.01),
                },
                2000,
              )
            }
          }
        }
      } catch (locationError) {
        console.log("Location error:", locationError)
        let errorMessage = "Unable to get your current location. "
        switch (locationError.code) {
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
      }

      setMapLoading(false)
    } catch (error) {
      console.log("Start to pickup error:", error)
      setMapLoading(false)
      Alert.alert("Error", "Failed to get route to pickup location.")
    }
  }

  const handlePickupToDrop = async () => {
    if (!tripData?.pickupLocation || !tripData?.dropLocation) {
      Alert.alert("Error", "Pickup and drop locations are required.")
      return
    }

    setMapLoading(true)
    setMapMode("pickupToDrop")

    try {
      const pickup = await geocodeAddress(tripData.pickupLocation)
      const drop = await geocodeAddress(tripData.dropLocation)

      if (pickup && drop) {
        setPickupCoords(pickup)
        setDropCoords(drop)
        const directions = await getDirections(pickup, drop)
        setPolylineCoords(directions)
      }
    } catch (error) {
      console.log("Pickup to drop error:", error)
      Alert.alert("Error", "Failed to get route from pickup to drop location.")
    } finally {
      setMapLoading(false)
    }
  }

  const getAssignedCab = async (): Promise<void> => {
    try {
      setLoading(true)
      const token = await AsyncStorage.getItem("userToken")

      if (token) {
        const cabResponse = await axios.get("https://api.routebudget.com/api/assignCab/driver", {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (cabResponse.data && cabResponse.data.length > 0) {
          setCabNumber(cabResponse.data[0].CabsDetail.cabNumber || "")
        }

        const tripResponse = await axios.get("https://api.routebudget.com/api/assignCab/driver/getassgnedcab", {
          headers: { Authorization: `Bearer ${token}` },
        })

        console.log("Trip Response:", tripResponse.data)

        if (tripResponse.data && tripResponse.data.assignment && tripResponse.data.assignment.length > 0) {
          const assignmentData = tripResponse.data.assignment[0]

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
          })
        }
      }
    } catch (error) {
      console.log("Error fetching assigned cab data:", error)
      Alert.alert("Error", "Failed to fetch trip details. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateString: string | null): string => {
    if (!dateString) return "Not set"
    try {
      const date = new Date(dateString)
      return date.toLocaleString()
    } catch {
      return "Invalid date"
    }
  }

  const formatCurrency = (amount: number | null): string => {
    if (amount === null || amount === undefined) return "Not set"
    return `₹${amount.toFixed(2)}`
  }

  const getMapRegion = () => {
    if (mapMode === "toPickup" && currentLocation && pickupCoords) {
      // Center between current location and pickup with appropriate zoom
      const midLat = (currentLocation.latitude + pickupCoords.latitude) / 2
      const midLng = (currentLocation.longitude + pickupCoords.longitude) / 2
      const latDelta = Math.abs(currentLocation.latitude - pickupCoords.latitude) * 1.5
      const lngDelta = Math.abs(currentLocation.longitude - pickupCoords.longitude) * 1.5

      return {
        latitude: midLat,
        longitude: midLng,
        latitudeDelta: Math.max(latDelta, 0.01), // Minimum zoom level
        longitudeDelta: Math.max(lngDelta, 0.01),
      }
    } else if (mapMode === "toPickup" && currentLocation) {
      // Center on current location with close zoom
      return {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      }
    } else if (pickupCoords && dropCoords) {
      // Center between pickup and drop
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

    // Default region (Mumbai area)
    return {
      latitude: 19.076,
      longitude: 72.8777,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    }
  }

  const handlePhonePress = () => {
    if (tripData?.customerPhone) {
      Linking.openURL(`tel:${tripData.customerPhone}`)
    }
  }

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
          {/* Customer Information Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="person" size={18} color="#F59E0B" />
              <Text style={styles.cardTitle}>Customer Information</Text>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <MaterialIcons name="person-outline" size={16} color="#92400E" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Customer Name</Text>
                  <Text style={styles.infoValue}>{tripData?.customerName || "Not provided"}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <MaterialIcons name="phone" size={16} color="#92400E" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone Number</Text>
                  <TouchableOpacity onPress={handlePhonePress} disabled={!tripData?.customerPhone}>
                    <Text style={[styles.infoValue, tripData?.customerPhone && styles.phoneNumber]}>
                      {tripData?.customerPhone || "Not provided"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

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

          {/* Timing Information Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="access-time" size={18} color="#F59E0B" />
              <Text style={styles.cardTitle}>Timing Information</Text>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <MaterialIcons name="event" size={16} color="#92400E" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Scheduled Pickup</Text>
                  <Text style={styles.infoValue}>{formatDateTime(tripData?.scheduledPickupTime)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <MaterialIcons name="play-circle-outline" size={16} color="#10b981" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Actual Pickup</Text>
                  <Text style={styles.infoValue}>{formatDateTime(tripData?.actualPickupTime)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <MaterialIcons name="stop-circle" size={16} color="#ef4444" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Drop Time</Text>
                  <Text style={styles.infoValue}>{formatDateTime(tripData?.dropTime)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Fare Information Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="payments" size={18} color="#F59E0B" />
              <Text style={styles.cardTitle}>Fare Information</Text>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <MaterialIcons name="calculate" size={16} color="#92400E" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Estimated Fare</Text>
                  <Text style={styles.infoValue}>{formatCurrency(tripData?.estimatedFare)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <MaterialIcons name="receipt" size={16} color="#10b981" />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoValue, tripData?.actualFare && styles.fareAmount]}>
                    {formatCurrency(tripData?.actualFare)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Additional Information Card */}
          {(tripData?.specialInstructions || tripData?.adminNotes) && (
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
          )}

          {/* No Trip Data Message */}
          {!tripData?.customerName && !tripData?.pickupLocation && (
            <View style={styles.noDataCard}>
              <MaterialIcons name="info-outline" size={24} color="#92400E" />
              <Text style={styles.noDataTitle}>No Active Trip</Text>
              <Text style={styles.noDataText}>
                No customer trip details are currently available. Trip information will appear here once a ride is
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
        onRequestClose={() => setShowMapModal(false)}
      >
        <View style={styles.mapContainer}>
          {/* Map Header */}
          <View style={styles.mapHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowMapModal(false)}>
              <MaterialIcons name="close" size={24} color="#1f2937" />
            </TouchableOpacity>
            <Text style={styles.mapHeaderTitle}>Trip Route</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Map Loading */}
          {mapLoading && (
            <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator size="large" color="#F59E0B" />
              <Text style={styles.mapLoadingText}>Loading route...</Text>
            </View>
          )}

          {/* Map View */}
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            region={getMapRegion()}
            showsUserLocation={false}
            showsMyLocationButton={true}
            showsTraffic={true}
            showsBuildings={true}
            showsIndoors={true}
            zoomEnabled={true}
            scrollEnabled={true}
            rotateEnabled={true}
            pitchEnabled={true}
            onMapReady={() => {
              console.log("Map is ready")
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
            {currentLocation && (
              <Marker
                coordinate={currentLocation}
                title="Your Location"
                description="Current driver location"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.currentLocationMarker}>
                  <View style={styles.currentLocationDot} />
                  <View style={styles.currentLocationPulse} />
                </View>
              </Marker>
            )}

            {/* Pickup Marker */}
            {pickupCoords && (
              <Marker
                coordinate={pickupCoords}
                title="Pickup Location"
                description={tripData?.pickupLocation || ""}
                anchor={{ x: 0.5, y: 1 }}
              >
                <View style={styles.pickupMarker}>
                  <MaterialIcons name="my-location" size={20} color="#ffffff" />
                </View>
              </Marker>
            )}

            {/* Drop Marker - Only show in full and pickupToDrop modes */}
            {(mapMode === "full" || mapMode === "pickupToDrop") && dropCoords && (
              <Marker
                coordinate={dropCoords}
                title="Drop Location"
                description={tripData?.dropLocation || ""}
                anchor={{ x: 0.5, y: 1 }}
              >
                <View style={styles.dropMarker}>
                  <MaterialIcons name="location-on" size={20} color="#ffffff" />
                </View>
              </Marker>
            )}

            {/* Route Polyline */}
            {polylineCoords.length > 0 && (
              <Polyline
                coordinates={polylineCoords}
                strokeColor={mapMode === "toPickup" ? "#F59E0B" : "#1e40af"}
                strokeWidth={5}
                geodesic={true}
                lineCap="round"
                lineJoin="round"
              />
            )}
          </MapView>

          {/* Map Control Buttons */}
          <View style={styles.mapControlsContainer}>
            <TouchableOpacity
              style={[styles.mapControlButton, mapMode === "toPickup" && styles.activeMapControlButton]}
              onPress={handleStartToPickup}
              activeOpacity={0.8}
            >
              <MaterialIcons name="near-me" size={18} color={mapMode === "toPickup" ? "#ffffff" : "#F59E0B"} />
              <Text style={[styles.mapControlText, mapMode === "toPickup" && styles.activeMapControlText]}>
                Start Location
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mapControlButton, mapMode === "pickupToDrop" && styles.activeMapControlButton]}
              onPress={handlePickupToDrop}
              activeOpacity={0.8}
            >
              <MaterialIcons name="directions" size={18} color={mapMode === "pickupToDrop" ? "#ffffff" : "#F59E0B"} />
              <Text style={[styles.mapControlText, mapMode === "pickupToDrop" && styles.activeMapControlText]}>
                Start Pickup
              </Text>
            </TouchableOpacity>
          </View>

          {/* Trip Info Overlay */}
          <View style={styles.tripInfoOverlay}>
            <View style={styles.tripInfoCard}>
              {mapMode === "toPickup" && (
                <>
                  <View style={styles.locationRow}>
                    <MaterialIcons name="my-location" size={16} color="#F59E0B" />
                    <Text style={styles.locationText} numberOfLines={1}>
                      Your Location
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

              {mapMode === "full" && (
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
    backgroundColor: "#FFFBEB", // Light yellow background
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
  fareAmount: {
    color: "#10b981",
    fontWeight: "700",
    fontSize: 16,
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
  // Fixed Button Styles
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
  // Map Modal Styles
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
  mapControlsContainer: {
    position: "absolute",
    bottom: 140,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 100,
  },
  mapControlButton: {
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 2,
    borderColor: "#FEF3C7",
    flex: 0.48,
  },
  activeMapControlButton: {
    backgroundColor: "#F59E0B",
    borderColor: "#F59E0B",
  },
  mapControlText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#F59E0B",
  },
  activeMapControlText: {
    color: "#ffffff",
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
  phoneNumber: {
    color: "#2563EB", // Added blue color to indicate clickable phone number
    textDecorationLine: "underline",
  },
})

export default CustomerDetailScreen
