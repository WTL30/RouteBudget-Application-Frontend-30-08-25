"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native"
import MaterialIcons from "react-native-vector-icons/MaterialIcons"
import axios from "react-native-axios"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { PermissionsAndroid, Platform } from "react-native"
import Geolocation from "@react-native-community/geolocation"

const CACHE_KEY = "location_suggestions_cache"
const CACHE_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

// Popular Indian cities for instant suggestions
const POPULAR_CITIES = [
  { display_name: "Mumbai, Maharashtra, India", lat: "19.076", lon: "72.8777", place_id: "mumbai" },
  { display_name: "Delhi, India", lat: "28.6139", lon: "77.2090", place_id: "delhi" },
  { display_name: "Bangalore, Karnataka, India", lat: "12.9716", lon: "77.5946", place_id: "bangalore" },
  { display_name: "Hyderabad, Telangana, India", lat: "17.3850", lon: "78.4867", place_id: "hyderabad" },
  { display_name: "Chennai, Tamil Nadu, India", lat: "13.0827", lon: "80.2707", place_id: "chennai" },
  { display_name: "Kolkata, West Bengal, India", lat: "22.5726", lon: "88.3639", place_id: "kolkata" },
  { display_name: "Pune, Maharashtra, India", lat: "18.5204", lon: "73.8567", place_id: "pune" },
  { display_name: "Ahmedabad, Gujarat, India", lat: "23.0225", lon: "72.5714", place_id: "ahmedabad" },
]

const LocationScreen = ({ onClose }) => {
  const [cabNumber, setCabNumber] = useState("")
  const [location, setLocation] = useState({ from: "", to: "" })
  const [validationErrors, setValidationErrors] = useState({ from: "", to: "" })
  const [searchResults, setSearchResults] = useState([])
  const [typingField, setTypingField] = useState("")
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [currentPosition, setCurrentPosition] = useState(null)
  const [driverId, setDriverId] = useState("")
  const [isTracking, setIsTracking] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const webSocketRef = useRef(null)
  const watchPositionRef = useRef(null)
  const currentRequestRef = useRef(null)
  const debounceTimeoutRef = useRef(null) // Add this ref
  const isTypingRef = useRef(false) // Add this ref to track typing state

  const SERVER_URL = "https://api.routebudget.com"
  const WS_URL = "ws://192.168.183.163:5000"

  const getCacheKey = (query) => `${CACHE_KEY}_${query.toLowerCase().trim()}`

  const getCachedSuggestions = async (query) => {
    try {
      const cacheKey = getCacheKey(query)
      const cached = await AsyncStorage.getItem(cacheKey)
      if (cached) {
        const { data, timestamp } = JSON.parse(cached)
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          return data
        }
        AsyncStorage.removeItem(cacheKey)
      }
    } catch (error) {
      console.error("Error getting cached suggestions:", error)
    }
    return null
  }

  const setCachedSuggestions = async (query, data) => {
    try {
      const cacheKey = getCacheKey(query)
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now(),
      }))
    } catch (error) {
      console.error("Error caching suggestions:", error)
    }
  }

  const getInstantSuggestions = (query) => {
    const lowerQuery = query.toLowerCase().trim()
    if (lowerQuery.length < 1) return []
    return POPULAR_CITIES.filter((city) => 
      city.display_name.toLowerCase().includes(lowerQuery)
    )
  }

  useEffect(() => {
    const getDriverId = async () => {
      try {
        const userId = await AsyncStorage.getItem("userid")
        setDriverId(userId)
      } catch (error) {
        console.error("Error getting driver ID:", error)
      }
    }

    getDriverId()
    getCab()
    startLocationTracking()
    initializeWebSocket()

    return () => {
      closeWebSocketConnection()
      if (watchPositionRef.current !== null) {
        Geolocation.clearWatch(watchPositionRef.current)
      }
      // Clean up debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  const initializeWebSocket = async () => {
    try {
      if (webSocketRef.current) {
        webSocketRef.current.close()
      }

      webSocketRef.current = new WebSocket(WS_URL)

      webSocketRef.current.onopen = () => {
        setIsConnected(true)
        if (driverId) {
          const registerMsg = {
            type: "register",
            driverId: driverId,
            role: "driver",
          }
          webSocketRef.current.send(JSON.stringify(registerMsg))
        }
      }

      webSocketRef.current.onclose = () => {
        setIsConnected(false)
        setTimeout(() => {
          if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.CLOSED) {
            initializeWebSocket()
          }
        }, 5000)
      }

      webSocketRef.current.onerror = (error) => {
        console.error("WebSocket error:", error)
      }
    } catch (error) {
      console.error("Error initializing WebSocket:", error)
    }
  }

  const closeWebSocketConnection = () => {
    if (webSocketRef.current) {
      if (webSocketRef.current.readyState === WebSocket.OPEN) {
        const disconnectMessage = {
          type: "DRIVER_DISCONNECT",
          payload: { driverId: driverId, cabNumber },
        }
        try {
          webSocketRef.current.send(JSON.stringify(disconnectMessage))
        } catch (error) {
          console.error("Error sending disconnect message:", error)
        }
      }
      webSocketRef.current.close()
      setIsConnected(false)
    }
  }

  const sendLocationUpdate = () => {
    if (!webSocketRef.current || webSocketRef.current.readyState !== WebSocket.OPEN) {
      return
    }

    if (!currentPosition || !driverId) {
      return
    }

    try {
      const locationData = {
        type: "location",
        driverId: driverId,
        role: "driver",
        location: {
          latitude: currentPosition.latitude,
          longitude: currentPosition.longitude,
          timestamp: new Date().toISOString(),
          from: location.from,
          to: location.to,
        },
      }
      webSocketRef.current.send(JSON.stringify(locationData))
    } catch (error) {
      console.error("Error sending location update:", error)
    }
  }

  const requestLocationPermission = async () => {
    if (Platform.OS === "ios") {
      const status = await Geolocation.requestAuthorization("whenInUse")
      return status === "granted"
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      )
      return granted === PermissionsAndroid.RESULTS.GRANTED
    }
  }

  const startLocationTracking = async () => {
    try {
      const hasPermission = await requestLocationPermission()
      if (!hasPermission) {
        Alert.alert("Permission Denied", "Location permission is required.")
        return
      }

      Geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const initialPosition = { latitude, longitude }
          setCurrentPosition(initialPosition)

          // Start watching position
          watchPositionRef.current = Geolocation.watchPosition(
            (position) => {
              const { latitude, longitude } = position.coords
              const newPosition = { latitude, longitude }
              setCurrentPosition(newPosition)
            },
            (error) => {
              console.error("Watch position error:", error)
            },
            {
              enableHighAccuracy: true,
              distanceFilter: 10,
              interval: 5000,
              fastestInterval: 2000,
              timeout: 60000,
            }
          )
        },
        (error) => {
          console.error("Get position error:", error)
          Alert.alert("Location Error", `Could not get your position: ${error.message}`)
        },
        {
          enableHighAccuracy: false,
          timeout: 30000,
          maximumAge: 60000,
        }
      )
    } catch (error) {
      console.error("Location tracking error:", error)
    }
  }

  const getCab = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken")
      if (token) {
        const response = await axios.get(`${SERVER_URL}/api/assignCab/driver`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.data.length > 0) {
          setCabNumber(response.data[0].CabsDetail.cabNumber)
        }
      }
    } catch (error) {
      console.error("Error fetching cab:", error)
    }
  }

  // FIXED: Updated fetchSuggestions function with better debouncing
  useEffect(() => {
    const fetchSuggestions = async () => {
      const query = typingField === "from" ? location.from : typingField === "to" ? location.to : ""
      const trimmedQuery = query.trim()

      if (!typingField || trimmedQuery.length < 1) {
        setSearchResults([])
        setShowSuggestions(false)
        return
      }

      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }

      // Set new timeout with longer delay to prevent interruption
      debounceTimeoutRef.current = setTimeout(async () => {
        // Don't fetch if user is actively typing
        if (isTypingRef.current) {
          return
        }

        setIsLoadingSuggestions(true)
        setShowSuggestions(true)

        try {
          const instantResults = getInstantSuggestions(trimmedQuery)
          if (instantResults.length > 0) {
            setSearchResults(instantResults)
          }

          if (trimmedQuery.length < 2) {
            setIsLoadingSuggestions(false)
            return
          }

          const cachedResults = await getCachedSuggestions(trimmedQuery)
          if (cachedResults && cachedResults.length > 0) {
            setSearchResults(cachedResults)
            setIsLoadingSuggestions(false)
            return
          }

          if (trimmedQuery.length >= 2) {
            if (currentRequestRef.current) {
              currentRequestRef.current.abort()
            }

            const controller = new AbortController()
            currentRequestRef.current = controller

            const timeoutId = setTimeout(() => controller.abort(), 8000)

            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?` +
              `q=${encodeURIComponent(trimmedQuery)}` +
              `&format=json&limit=8&countrycodes=in&addressdetails=1`,
              { signal: controller.signal }
            )

            clearTimeout(timeoutId)

            if (!controller.signal.aborted) {
              const data = await response.json()
              const filteredResults = data
                .filter((item) => {
                  const displayName = item.display_name.toLowerCase()
                  const searchQuery = trimmedQuery.toLowerCase()
                  return displayName.includes(searchQuery)
                })
                .slice(0, 6)

              const combinedResults = [...instantResults]
              filteredResults.forEach((apiResult) => {
                const exists = combinedResults.some(
                  (existing) => existing.display_name.toLowerCase() === apiResult.display_name.toLowerCase()
                )
                if (!exists) {
                  combinedResults.push(apiResult)
                }
              })

              const finalResults = combinedResults.slice(0, 8)
              setSearchResults(finalResults)

              if (finalResults.length > 0) {
                setCachedSuggestions(trimmedQuery, finalResults)
              }
            }
          }
        } catch (error) {
          if (error.name !== "AbortError") {
            const instantResults = getInstantSuggestions(trimmedQuery)
            setSearchResults(instantResults)
          }
        } finally {
          setIsLoadingSuggestions(false)
          currentRequestRef.current = null
        }
      }, 800) // Increased debounce delay to 800ms
    }

    fetchSuggestions()

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [location.from, location.to, typingField])

  const validateInputs = () => {
    const errors = { from: "", to: "" }
    let isValid = true

    if (!location.from.trim()) {
      errors.from = "Pickup location is required"
      isValid = false
    }

    if (!location.to.trim()) {
      errors.to = "Drop-off location is required"
      isValid = false
    }

    setValidationErrors(errors)
    return isValid
  }

  // FIXED: Updated handleLocationChange to prevent interruption
  const handleLocationChange = (field, value) => {
    isTypingRef.current = true // Mark as typing
    
    setLocation((prev) => ({ ...prev, [field]: value }))
    setValidationErrors((prev) => ({
      ...prev,
      [field]: value.trim() ? "" : `${field === "from" ? "Pickup" : "Drop-off"} location is required`,
    }))

    // Clear typing flag after a short delay
    setTimeout(() => {
      isTypingRef.current = false
    }, 100)
  }

  const handleSelectLocation = (item) => {
    if (typingField && item.place_id !== "loading") {
      const address = item.display_name.split(", India")[0]
      
      // Clear typing flag and cancel any pending requests
      isTypingRef.current = false
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      if (currentRequestRef.current) {
        currentRequestRef.current.abort()
      }

      handleLocationChange(typingField, address)
      setSearchResults([])
      setTypingField("")
      setShowSuggestions(false)
      setIsLoadingSuggestions(false)
    }
  }

  const handleSubmit = async () => {
    if (!validateInputs()) {
      return
    }

    if (!cabNumber) {
      Alert.alert("Error", "No cab assigned to you")
      return
    }

    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append("pickupLocation", location.from)
      formData.append("dropLocation", location.to)

      const token = await AsyncStorage.getItem("userToken")
      
      console.log("Sending data:", {
        pickupLocation: location.from,
        dropLocation: location.to
      })

      const response = await axios.patch(`${SERVER_URL}/api/assigncab/update-trip`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.status === 200) {
        setIsTracking(true)
        Alert.alert("Success", "Location submitted successfully! Location sharing is now active.", [
          { text: "OK", onPress: () => onClose && onClose() }
        ])

        // Start continuous location updates
        if (isConnected && currentPosition) {
          sendLocationUpdate()
          const intervalId = setInterval(() => {
            if (isTracking && isConnected && currentPosition) {
              sendLocationUpdate()
            } else {
              clearInterval(intervalId)
            }
          }, 10000)
        }
      }
    } catch (error) {
      console.error("Error submitting location:", error)
      Alert.alert("Error", "Failed to submit location information.")
    } finally {
      setIsSubmitting(false)
    }

    Keyboard.dismiss()
  }

  const formatLocationName = (displayName) => {
    const parts = displayName.split(", ")
    const relevantParts = parts.slice(0, Math.min(4, parts.length))
    return relevantParts.join(", ")
  }

  const handleInputFocus = (field) => {
    setTypingField(field)
    const query = field === "from" ? location.from : location.to
    if (query.trim().length > 0) {
      setShowSuggestions(true)
    }
  }

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow selection
    setTimeout(() => {
      setShowSuggestions(false)
      setTypingField("")
      setSearchResults([])
      isTypingRef.current = false // Clear typing flag on blur
    }, 200)
  }

  const closeSuggestionsModal = () => {
    setShowSuggestions(false)
    setTypingField("")
    setSearchResults([])
    isTypingRef.current = false
    Keyboard.dismiss()
  }

  const SuggestionsModal = () => (
    <Modal
      visible={showSuggestions && searchResults.length > 0}
      transparent={true}
      animationType="fade"
      onRequestClose={closeSuggestionsModal}
    >
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1} 
        onPress={closeSuggestionsModal}
      >
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
              keyExtractor={(item) => item.place_id?.toString() || Math.random().toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.suggestionItem} 
                  onPress={() => {
                    handleSelectLocation(item)
                    closeSuggestionsModal()
                  }}
                >
                  <MaterialIcons name="place" size={16} color="#666" />
                  <Text numberOfLines={2} style={styles.suggestionText}>
                    {formatLocationName(item.display_name)}
                  </Text>
                </TouchableOpacity>
              )}
              style={styles.suggestionsList}
              showsVerticalScrollIndicator={false}
              maxToRenderPerBatch={10}
              windowSize={10}
            />
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  )

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <View style={styles.content}>
        {/* Location Cards */}
        <View style={styles.locationContainer}>
          {/* Pickup Location */}
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
                  // onFocus={() => handleInputFocus("from")}
                  onBlur={handleInputBlur}
                  onChangeText={(text) => handleLocationChange("from", text)}
                  autoCorrect={false}
                  autoCapitalize="words"
                />
                {validationErrors.from ? (
                  <Text style={styles.errorText}>{validationErrors.from}</Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Connection Line */}
          <View style={styles.connectionLine}>
            <View style={styles.dottedLine} />
          </View>

          {/* Drop-off Location */}
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
                {validationErrors.to ? (
                  <Text style={styles.errorText}>{validationErrors.to}</Text>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* Status Card */}
        {isTracking && (
          <View style={styles.statusCard}>
            <View style={styles.statusContent}>
              <MaterialIcons name="gps-fixed" size={20} color="#4CAF50" />
              <Text style={styles.statusCardText}>Location Sharing Active</Text>
            </View>
            <View style={styles.pulseAnimation}>
              <View style={styles.pulse} />
            </View>
          </View>
        )}
      </View>

      {/* Submit Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.submitButton, isSubmitting && styles.submittingButton]} 
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="send" size={20} color="#fff" />
          )}
          <Text style={styles.submitButtonText}>
            {isSubmitting ? "Submitting..." : "Submit Location"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Suggestions Modal */}
      <SuggestionsModal />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fefefe",
    maxHeight: '100%', // FIXED: Add max height constraint
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    // paddingTop: 12, // FIXED: Reduced top padding
    // paddingBottom: 8, // FIXED: Add bottom padding
  },
  locationContainer: {
    // marginBottom: 16, // FIXED: Reduced margin
  },
  locationWrapper: {
    // marginBottom: 12, // FIXED: Reduced margin
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 11,
    padding: 11,
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
    width: 34,
    height: 34,
    borderRadius: 12,
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
  },
  inputLabel: {
    fontSize: 12,
    color: "#FFA726",
    fontWeight: "600",
    marginBottom: 1,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textInput: {
    fontSize: 14,
    color: "#333",
    paddingVertical: 1,
    fontWeight: "500",
    minHeight: 24, // FIXED: Add minimum height
  },
  errorText: {
    fontSize: 12,
    color: "#FF5722",
    marginTop: 4,
    fontWeight: "500",
  },
  connectionLine: {
    alignItems: "center",
    marginVertical: 6, // FIXED: Reduced margin
  },
  dottedLine: {
    width: 2,
    height: 16, // FIXED: Reduced height
    backgroundColor: "#E0E0E0",
    borderRadius: 1,
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
    maxHeight: "60%", // FIXED: Reduced max height
  },
  suggestionsModalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  suggestionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  suggestionsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#FFA726",
    fontWeight: "500",
  },
  suggestionsList: {
    maxHeight: 250, // FIXED: Reduced max height
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f8f8f8",
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    marginLeft: 12,
    fontWeight: "500",
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#E8F5E8",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12, // FIXED: Reduced margin
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  statusContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusCardText: {
    fontSize: 16,
    color: "#2E7D32",
    fontWeight: "600",
    marginLeft: 8,
  },
  pulseAnimation: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4CAF50",
    position: "relative",
  },
  pulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4CAF50",
    opacity: 0.6,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 1, // FIXED: Reduced padding
    // paddingBottom: 20, // FIXED: Reduced bottom padding
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFA726",
    borderRadius: 16,
    paddingVertical: 10, // FIXED: Reduced padding
    paddingHorizontal: 24,
    shadowColor: "#FFA726",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submittingButton: {
    backgroundColor: "#FFB74D",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 8,
    letterSpacing: 0.5,
  },
})

export default LocationScreen







// import React, { useState, useEffect, useRef } from "react";
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   ScrollView,
//   StatusBar,
//   StyleSheet,
//   SafeAreaView,
//   FlatList,
//   Keyboard,
//   KeyboardAvoidingView
// } from "react-native";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import axios from "react-native-axios";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { PermissionsAndroid, Platform, Alert } from 'react-native';
// import Geolocation from '@react-native-community/geolocation';
// import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
// import Icon from "react-native-vector-icons/Ionicons";
// import { useFocusEffect } from '@react-navigation/native';

// // Add these at the top of your component, outside the component function
// const CACHE_KEY = 'location_suggestions_cache';
// const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// // Popular Indian cities for instant suggestions
// const POPULAR_CITIES = [
//   { display_name: "Mumbai, Maharashtra, India", lat: "19.076", lon: "72.8777", place_id: "mumbai" },
//   { display_name: "Delhi, India", lat: "28.6139", lon: "77.2090", place_id: "delhi" },
//   { display_name: "Bangalore, Karnataka, India", lat: "12.9716", lon: "77.5946", place_id: "bangalore" },
//   { display_name: "Hyderabad, Telangana, India", lat: "17.3850", lon: "78.4867", place_id: "hyderabad" },
//   { display_name: "Chennai, Tamil Nadu, India", lat: "13.0827", lon: "80.2707", place_id: "chennai" },
//   { display_name: "Kolkata, West Bengal, India", lat: "22.5726", lon: "88.3639", place_id: "kolkata" },
//   { display_name: "Pune, Maharashtra, India", lat: "18.5204", lon: "73.8567", place_id: "pune" },
//   { display_name: "Ahmedabad, Gujarat, India", lat: "23.0225", lon: "72.5714", place_id: "ahmedabad" },
//   { display_name: "Jaipur, Rajasthan, India", lat: "26.9124", lon: "75.7873", place_id: "jaipur" },
//   { display_name: "Surat, Gujarat, India", lat: "21.1702", lon: "72.8311", place_id: "surat" }
// ];

// const LocationScreen = ({ navigation }) => {
//   const [cabNumber, setCabNumber] = useState("");
//   const [error, setError] = useState("");
//   const [location, setLocation] = useState({ from: "", to: "",totalDistance:"" });
//   const [validationErrors, setValidationErrors] = useState({ from: "", to: "" });
//   const [formSubmitted, setFormSubmitted] = useState(false);
//   const [searchResults, setSearchResults] = useState([]);
//   const [typingField, setTypingField] = useState(""); 
//   const [keyboardVisible, setKeyboardVisible] = useState(false);
//   const wsRef = useRef(null);
  
//   const mapRef = useRef(null);
//   const [region, setRegion] = useState(null);
//   const [currentPosition, setCurrentPosition] = useState(null);
//   const [currentPositionAdd,setcurrentPositionAdd] = useState(null)
//   const [fromCoords, setFromCoords] = useState(null);
//   const [toCoords, setToCoords] = useState(null);
//   const [routeCoordinates, setRouteCoordinates] = useState([]);
//   const watchPositionRef = useRef(null);
//   const [driverId,setDriverId] = useState("")
  
//   const webSocketRef = useRef(null);
//   const [isConnected, setIsConnected] = useState(false);
//   const [isTracking, setIsTracking] = useState(false);
  
//   // Add these NEW state variables for optimization
//   const [suggestionCache, setSuggestionCache] = useState(new Map());
//   const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
//   const currentRequestRef = useRef(null);

//   const previousPosition = useRef(null);
  
//   const SERVER_URL = "http://192.168.1.34:5000";
//   const WS_URL = "wss://api.routebudget.com";

//   // Cache management functions - ADD THESE NEW FUNCTIONS
//   const getCacheKey = (query) => `${CACHE_KEY}_${query.toLowerCase().trim()}`;

//   const getCachedSuggestions = async (query) => {
//     try {
//       const cacheKey = getCacheKey(query);
//       const cached = await AsyncStorage.getItem(cacheKey);
      
//       if (cached) {
//         const { data, timestamp } = JSON.parse(cached);
//         const now = Date.now();
        
//         if (now - timestamp < CACHE_EXPIRY) {
//           return data;
//         } else {
//           // Remove expired cache
//           AsyncStorage.removeItem(cacheKey);
//         }
//       }
//     } catch (error) {
//       console.error('Error getting cached suggestions:', error);
//     }
//     return null;
//   };

//   const setCachedSuggestions = async (query, data) => {
//     try {
//       const cacheKey = getCacheKey(query);
//       const cacheData = {
//         data,
//         timestamp: Date.now()
//       };
//       await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
//     } catch (error) {
//       console.error('Error caching suggestions:', error);
//     }
//   };

//   // Fast local search function - ADD THIS NEW FUNCTION
//   const getInstantSuggestions = (query) => {
//     const lowerQuery = query.toLowerCase().trim();
    
//     if (lowerQuery.length < 1) return [];
    
//     return POPULAR_CITIES.filter(city => 
//       city.display_name.toLowerCase().includes(lowerQuery)
//     );
//   };

//   // Add this function to preload popular cities cache - NEW FUNCTION
//   const preloadPopularCities = async () => {
//     try {
//       for (const city of POPULAR_CITIES.slice(0, 5)) { // Preload top 5 cities
//         const cacheKey = getCacheKey(city.display_name.split(',')[0]);
//         const exists = await AsyncStorage.getItem(cacheKey);
        
//         if (!exists) {
//           await setCachedSuggestions(city.display_name.split(',')[0], [city]);
//         }
//       }
//     } catch (error) {
//       console.error('Error preloading cities:', error);
//     }
//   };

//   // REPLACE your existing useEffect for suggestions with this optimized version
//   useEffect(() => {
//     const fetchSuggestions = async () => {
//       const query = typingField ? location[typingField] : "";
//       const trimmedQuery = query.trim();
      
//       if (trimmedQuery.length < 2) {
//         setSearchResults([]);
//         return;
//       }

//       // Cancel previous request
//       if (currentRequestRef.current) {
//         currentRequestRef.current.abort();
//       }

//       setIsLoadingSuggestions(true);
      
//       try {
//         // Step 1: Show instant suggestions immediately
//         const instantResults = getInstantSuggestions(trimmedQuery);
//         if (instantResults.length > 0) {
//           setSearchResults(instantResults);
//         } else {
//           setSearchResults([{ display_name: "Searching...", place_id: "loading" }]);
//         }

//         // Step 2: Check cache
//         const cachedResults = await getCachedSuggestions(trimmedQuery);
//         if (cachedResults && cachedResults.length > 0) {
//           setSearchResults(cachedResults);
//           setIsLoadingSuggestions(false);
//           return;
//         }

//         // Step 3: Make API call only if no cache found
//         const controller = new AbortController();
//         currentRequestRef.current = controller;
        
//         const timeoutId = setTimeout(() => controller.abort(), 8000);
        
//         const response = await fetch(
//           `https://nominatim.openstreetmap.org/search?` +
//           `q=${encodeURIComponent(trimmedQuery)}` +
//           `&format=json` +
//           `&limit=8` +
//           `&countrycodes=in` +
//           `&addressdetails=1` +
//           `&bounded=1` +
//           `&dedupe=1`,
//           { 
//             signal: controller.signal
//           }
//         );
        
//         clearTimeout(timeoutId);
        
//         if (controller.signal.aborted) {
//           return;
//         }
        
//         const data = await response.json();
        
//         // Filter and sort results
//         const filteredResults = data
//           .filter(item => {
//             const displayName = item.display_name.toLowerCase();
//             const searchQuery = trimmedQuery.toLowerCase();
//             return displayName.includes(searchQuery);
//           })
//           .sort((a, b) => {
//             const aSpecificity = (a.address?.house_number ? 3 : 0) + 
//                                 (a.address?.road ? 2 : 0) + 
//                                 (a.address?.neighbourhood ? 1 : 0);
//             const bSpecificity = (b.address?.house_number ? 3 : 0) + 
//                                 (b.address?.road ? 2 : 0) + 
//                                 (b.address?.neighbourhood ? 1 : 0);
//             return bSpecificity - aSpecificity;
//           })
//           .slice(0, 6);
        
//         // Combine instant results with API results, removing duplicates
//         const combinedResults = [...instantResults];
//         filteredResults.forEach(apiResult => {
//           const exists = combinedResults.some(existing => 
//             existing.display_name.toLowerCase() === apiResult.display_name.toLowerCase()
//           );
//           if (!exists) {
//             combinedResults.push(apiResult);
//           }
//         });
        
//         const finalResults = combinedResults.slice(0, 8);
//         setSearchResults(finalResults);
        
//         // Cache the results for future use
//         if (finalResults.length > 0) {
//           setCachedSuggestions(trimmedQuery, finalResults);
//         }
        
//       } catch (error) {
//         if (error.name !== 'AbortError') {
//           console.error("Error fetching location suggestions:", error);
//           // Fallback to instant suggestions only
//           const instantResults = getInstantSuggestions(trimmedQuery);
//           setSearchResults(instantResults);
//         }
//       } finally {
//         setIsLoadingSuggestions(false);
//         currentRequestRef.current = null;
//       }
//     };

//     if (!typingField) {
//       setSearchResults([]);
//       return;
//     }

//     const query = location[typingField];
    
//     if (!query || query.length < 2) {
//       setSearchResults([]);
//       return;
//     }

//     // Immediate response for short queries
//     if (query.length < 3) {
//       const instantResults = getInstantSuggestions(query);
//       setSearchResults(instantResults);
//       return;
//     }

//     // Debounced API call for longer queries
//     const debounceTimeout = setTimeout(() => {
//       fetchSuggestions();
//     }, 300); // Reduced debounce time

//     return () => {
//       clearTimeout(debounceTimeout);
//     };
//   }, [location.from, location.to, typingField]);

//   // REPLACE your existing handleSelectLocation function with this enhanced version
//   const handleSelectLocation = async (item) => {
//     if (typingField && item.place_id !== "loading") {
//       // Clear suggestions immediately
//       setSearchResults([]);
//       setIsLoadingSuggestions(false);
      
//       // Cancel any ongoing request
//       if (currentRequestRef.current) {
//         currentRequestRef.current.abort();
//       }
      
//       // Extract address
//       const address = item.display_name.split(', India')[0];
//       handleLocationChange(typingField, address);
      
//       // Set coordinates
//       const lat = parseFloat(item.lat);
//       const lon = parseFloat(item.lon);
//       const coords = { latitude: lat, longitude: lon };
      
//       if (typingField === 'from') {
//         setFromCoords(coords);
//       } else if (typingField === 'to') {
//         setToCoords(coords);
//       }
      
//       // Clear typing field
//       setTypingField("");
      
//       // Save data
//       setTimeout(() => {
//         saveLocationData();
//       }, 100);
//     }
//   };

//   // ADD these new input handler functions
//   const handleInputFocus = (field) => {
//     setTypingField(field);
    
//     // Show instant suggestions if there's existing text
//     const currentValue = location[field];
//     if (currentValue && currentValue.length >= 2) {
//       const instantResults = getInstantSuggestions(currentValue);
//       if (instantResults.length > 0) {
//         setSearchResults(instantResults);
//       }
//     }
//   };

//   const handleInputBlur = () => {
//     // Delay clearing to allow for suggestion selection
//     setTimeout(() => {
//       if (!isLoadingSuggestions) {
//         setTypingField("");
//         setSearchResults([]);
//       }
//     }, 200);
//   };

//   // Your existing useEffects and functions remain the same...
//   useEffect(() => {
//     const keyboardDidShowListener = Keyboard.addListener(
//       'keyboardDidShow',
//       () => {
//         setKeyboardVisible(true);
//       }
//     );
//     const keyboardDidHideListener = Keyboard.addListener(
//       'keyboardDidHide',
//       () => {
//         setKeyboardVisible(false);
//       }
//     );

//     return () => {
//       keyboardDidShowListener.remove();
//       keyboardDidHideListener.remove();
//     };
//   }, []);

//   useEffect(() => {
//     const getDriverId = async () => {
//       try {
//         const userId = await AsyncStorage.getItem("userid");
//         setDriverId(userId)
//       } catch (error) {
//       }
//     };
    
//     getDriverId();
    
//     // ADD: Preload popular cities for faster suggestions
//     preloadPopularCities();
    
//     return () => {
//       closeWebSocketConnection();
//     };
//   }, []);

//   // All your other existing useEffects and functions remain exactly the same...
//   useEffect(() => {
//     startLocationTracking();
    
//     return () => {
//       if (watchPositionRef.current !== null) {
//         Geolocation.clearWatch(watchPositionRef.current);
//       }
//     };
//   }, []);

//   useEffect(() => {
//     if (fromCoords && toCoords) {
//       fetchRoute(fromCoords, toCoords);
//     }
//   }, [fromCoords, toCoords]);

//   useEffect(() => {
//     if (isTracking && isConnected && currentPosition && driverId) {
//       sendLocationUpdate();
      
//       const intervalId = setInterval(() => {
//         if (isTracking && isConnected && currentPosition) {
//           sendLocationUpdate();
//         }
//       }, 10000);
      
//       return () => clearInterval(intervalId);
//     }
//   }, [currentPosition, isTracking, isConnected]);

//   useEffect(() => {
//     initializeWebSocket();
//     return () => {
//       webSocketRef.current?.close();
//     };
//   }, []);

//   useEffect(() => {
//     if (currentPosition && mapRef.current) {
//       mapRef.current.animateToRegion(
//         {
//           ...currentPosition,
//           latitudeDelta: 0.01,
//           longitudeDelta: 0.01,
//         },
//         500
//       );
//     }
//   }, [currentPosition]);

//   // All your existing functions remain the same (initializeWebSocket, closeWebSocketConnection, etc.)
//   const initializeWebSocket = async () => {
//     try {
//       if (webSocketRef.current) {
//         webSocketRef.current.close();
//       }
      
//       webSocketRef.current = new WebSocket(WS_URL);
      
//       webSocketRef.current.onopen = () => {
//         setIsConnected(true);
        
//         if (driverId) {
//           const registerMsg = {
//             type: 'register',
//             driverId: driverId,
//             role: 'driver',
//           };
//           webSocketRef.current.send(JSON.stringify(registerMsg));
//         }
//       };
      
//       webSocketRef.current.onclose = (event) => {
//         setIsConnected(false);
        
//         setTimeout(() => {
//           if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.CLOSED) {
//             initializeWebSocket();
//           }
//         }, 5000);
//       };
      
//       webSocketRef.current.onerror = (error) => {
//       };
      
//       webSocketRef.current.onmessage = (event) => {
//         try {
//           const data = JSON.parse(event.data);
          
//           switch (data.type) {
//             case "location":
//               sendLocationUpdate();
//               break;
//             case "register_confirmation":
//               break;
//             case "ERROR":
//               Alert.alert("Server Error", data.payload?.message || "Unknown server error");
//               break;
//             default:
//           }
//         } catch (error) {
//         }
//       };
//     } catch (error) {
//     }
//   };

//   const closeWebSocketConnection = () => {
//     if (webSocketRef.current) {
//       if (webSocketRef.current.readyState === WebSocket.OPEN) {
//         const disconnectMessage = {
//           type: "DRIVER_DISCONNECT",
//           payload: {
//             driverId: driverId.current,
//             cabNumber
//           }
//         };
        
//         try {
//           webSocketRef.current.send(JSON.stringify(disconnectMessage));
//         } catch (error) {
//         }
//       }
      
//       setIsTracking(false);
//       webSocketRef.current.close();
//       setIsConnected(false);
//     }
//   };

//   const sendLocationUpdate = () => {
//     if (!webSocketRef.current || webSocketRef.current.readyState !== WebSocket.OPEN) {
//       return;
//     }
    
//     if (!currentPosition) {
//       return;
//     }
    
//     if (!driverId) {
//       return;
//     }
    
//     try {
//       const locationData = {
//         type: "location",
//         driverId: driverId,
//         role: "driver",
//         location: {
//           latitude: currentPosition.latitude,
//           longitude: currentPosition.longitude,
//           timestamp: new Date().toISOString(),
//           from: location.from,
//           to: location.to
//         }
//       };
//       console.log("current location",currentPosition.latitude,currentPosition.longitude);
      
//       webSocketRef.current.send(JSON.stringify(locationData));
//     } catch (error) {
//     }
//   };

//   const calculateBearingAngle = () => {
//     if (previousPosition.current && currentPosition) {
//       const { latitude: lat1, longitude: lon1 } = previousPosition.current;
//       const { latitude: lat2, longitude: lon2 } = currentPosition;
      
//       const toRad = (value) => (value * Math.PI) / 180;
//       const toDeg = (value) => (value * 180) / Math.PI;
      
//       const dLon = toRad(lon2 - lon1);
//       const y = Math.sin(dLon) * Math.cos(toRad(lat2));
//       const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
//               Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
              
//       let brng = toDeg(Math.atan2(y, x));
//       brng = (brng + 360) % 360;
      
//       return brng;
//     }
//     return 0;
//   };

//   const requestLocationPermission = async () => {
//     if (Platform.OS === 'ios') {
//       const status = await Geolocation.requestAuthorization('whenInUse');
//       return status === 'granted';
//     } else {
//       const granted = await PermissionsAndroid.request(
//         PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
//       );
//       return granted === PermissionsAndroid.RESULTS.GRANTED;
//     }
//   };

//   const reverseGeocodeLocation = async (lat, lon) => {
//     try {
//       const response = await fetch(
//         `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
//       );
//       const data = await response.json();
  
//       if (data?.display_name) {
//         setLocation(prev => {
//           if (!prev.from) {
//             return { ...prev, from: data.display_name };
//           }
//           return prev;
//         });
//       }
//     } catch (err) {
//     }
//   };

//   const startLocationTracking = async () => {
//     try {
//       const hasPermission = await requestLocationPermission();
      
//       if (!hasPermission) {
//         Alert.alert('Permission Denied', 'Location permission is required to track position.');
//         return;
//       }
      
//       const useLastKnownOrDefaultPosition = async () => {
//         try {
//           const lastPositionJson = await AsyncStorage.getItem('lastKnownPosition');
//           if (lastPositionJson) {
//             const lastPosition = JSON.parse(lastPositionJson);
//             setCurrentPosition(lastPosition);
//             previousPosition.current = lastPosition;
//             setRegion({
//               latitude: lastPosition.latitude,
//               longitude: lastPosition.longitude,
//               latitudeDelta: 0.01,
//               longitudeDelta: 0.01,
//             });
//             return;
//           }
//         } catch (error) {
//         }
        
//         const defaultPosition = { latitude: 28.6139, longitude: 77.2090 };
//         setCurrentPosition(defaultPosition);
//         previousPosition.current = defaultPosition;
//         setRegion({
//           latitude: defaultPosition.latitude,
//           longitude: defaultPosition.longitude,
//           latitudeDelta: 0.05,
//           longitudeDelta: 0.05,
//         });
//       };
      
//       const getInitialPosition = (retryCount = 0) => {
//         Geolocation.getCurrentPosition(
//           (position) => {
//             const { latitude, longitude, accuracy } = position.coords;
            
//             const initialPosition = { latitude, longitude };
//             setCurrentPosition(initialPosition);

//             previousPosition.current = initialPosition;
//             setRegion({
//               latitude,
//               longitude,
//               latitudeDelta: 0.01,
//               longitudeDelta: 0.01,
//             });
            
//             try {
//               AsyncStorage.setItem('lastKnownPosition', JSON.stringify(initialPosition));
//             } catch (error) {
//             }
            
//             setupPositionWatcher();
//           },
//           (error) => {
//             if (error.code === 3) {
//               if (retryCount < 3) {
//                 setTimeout(() => getInitialPosition(retryCount + 1), 2000);
//               } else {
//                 useLastKnownOrDefaultPosition().then(() => {
//                   setupPositionWatcher();
//                 });
//               }
//             } else {
//               Alert.alert(
//                 'Location Error', 
//                 `Could not get your position: ${error.message}`,
//                 [{ text: 'OK', onPress: () => {
//                   useLastKnownOrDefaultPosition().then(() => {
//                     setupPositionWatcher();
//                   });
//                 }}]
//               );
//             }
//           },
//           { 
//             enableHighAccuracy: false,
//             timeout: 30000,
//             maximumAge: 60000
//           }
//         );
//       };
  
//       const setupPositionWatcher = () => {
//         if (watchPositionRef.current !== null) {
//           Geolocation.clearWatch(watchPositionRef.current);
//         }
        
//         watchPositionRef.current = Geolocation.watchPosition(
//           (position) => {
//             const { latitude, longitude, accuracy, speed, heading } = position.coords;
//             const timestamp = new Date(position.timestamp).toISOString();
            
//             const newPosition = { latitude, longitude };
//             setCurrentPosition(newPosition);
            
//             try {
//               AsyncStorage.setItem('lastKnownPosition', JSON.stringify(newPosition));
//             } catch (error) {
//             }
//           },
//           (error) => {
//             if (currentPosition) {
//             }
//           },
//           { 
//             enableHighAccuracy: true, 
//             distanceFilter: 1,
//             interval: 5000,
//             fastestInterval: 2000,
//             timeout: 60000
//           }
//         );
//       };
      
//       getInitialPosition();
      
//     } catch (error) {
//       Alert.alert('Error', 'Failed to start location tracking: ' + error.message);
//     }
//   };

//   const geocodeAddress = async (address, locationType) => {
//     try {
//       const response = await fetch(
//         `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=in`
//       );
//       const data = await response.json();
      
//       if (data && data.length > 0) {
//         const { lat, lon } = data[0];
//         const coordinates = { latitude: parseFloat(lat), longitude: parseFloat(lon) };
        
//         if (locationType === 'from') {
//           setFromCoords(coordinates);
//         } else if (locationType === 'to') {
//           setToCoords(coordinates);
//         }
        
//         return coordinates;
//       }
//       return null;
//     } catch (error) {
//       return null;
//     }
//   };

//   const fetchRoute = async (start, end) => {
//     try {
//       const response = await fetch(
//         `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`
//       );
//       const data = await response.json();
      
//       if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
//         const routeGeometry = data.routes[0].geometry;
//         const coords = routeGeometry.coordinates.map(([lng, lat]) => ({
//           latitude: lat,
//           longitude: lng,
//         }));
        
//         setRouteCoordinates(coords);
        
//         if (mapRef.current && coords.length > 0) {
//           mapRef.current.fitToCoordinates(coords, {
//             edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
//             animated: true,
//           });
//         }
//       }
//     } catch (error) {
//     }
//   };

//   const getCab = async () => {
//     try {
//       const token = await AsyncStorage.getItem("userToken");
//       if (token) {
//         const response = await axios.get(`${SERVER_URL}/api/assignCab/driver`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });
        
//         if (response.data.length > 0) {
//           setCabNumber(response.data[0]?.cab?.cabNumber);
//         }
//       }
//     } catch (error) {
//       Alert.alert("Error", "Failed to fetch assigned cab data");
//     }
//   };

//   useEffect(() => {
//     getCab();
//   }, []);

//   const validateInputs = () => {
//     const errors = { from: "", to: "" };
//     let isValid = true;

//     if (!location.from.trim()) {
//       errors.from = "Pickup location is required";
//       isValid = false;
//     }

//     if (!location.to.trim()) {
//       errors.to = "Drop-off location is required";
//       isValid = false;
//     }

//     setValidationErrors(errors);
//     return isValid;
//   };

//   const handleLocationChange = (field, value) => {
//     setLocation((prev) => ({ ...prev, [field]: value }));

//     if (formSubmitted) {
//       setValidationErrors((prev) => ({
//         ...prev,
//         [field]: value.trim() ? "" : `${field === "from" ? "Pickup" : "Drop-off"} location is required`,
//       }));
//     }
//   };

//   const watchId = useRef(null);

//   const handleConfirmLocation = async () => {
//     setFormSubmitted(true);
  
//     if (!validateInputs()) {
//       return;
//     }
  
//     if (cabNumber) {
//       try {
//         const formData = new FormData();
//         formData.append("location", JSON.stringify(location));
  
//         const token = await AsyncStorage.getItem("userToken");
//         const response = await axios.patch(
//           `${SERVER_URL}/api/assigncab/update-trip`,
//           formData,
//           {
//             headers: {
//               "Content-Type": "multipart/form-data",
//               Authorization: `Bearer ${token}`,
//             },
//           }
//         );
  
//         if (response.status === 200) {
//           await saveLocationData();
  
//           Alert.alert("Success", "Location submitted successfully!", [
//             {
//               text: "OK",
              
//             },
//           ]);
//           setIsTracking(true);
  
//           if (isConnected) {
//             sendLocationUpdate();
  
//             const intervalId = setInterval(() => {
//               if (isTracking && isConnected) {
//                 sendLocationUpdate();
//               } else {
//                 clearInterval(intervalId);
//               }
//             }, 10000);
//           } else {
//             Alert.alert("Warning", "WebSocket not connected. Location tracking may not work properly.");
//             initializeWebSocket();
//           }
//         }
//       } catch (error) {
//         Alert.alert("Error", "Failed to submit location information.");
//       }
//     } else {
//       Alert.alert("No cab assigned to you");
//     }
  
//     Keyboard.dismiss();
//   };
  
 
//   const formatLocationName = (displayName) => {
//     // Extract just the relevant part of the address for India
//     const parts = displayName.split(', ');
//     // Keep only the first 3-4 parts or until we find state/district names
//     const relevantParts = parts.slice(0, Math.min(4, parts.length));
//     return relevantParts.join(', ');
//   };

//   const saveLocationData = async () => {
//     try {
//       if (location.from && location.to) {
//         const locationData = {
//           location,
//           fromCoords,
//           toCoords,
//           routeCoordinates
//         };
//         await AsyncStorage.setItem('savedLocationData', JSON.stringify(locationData));
//       }
//     } catch (error) {
//       console.error("Failed to save location data:", error);
//     }
//   };


//   const loadLocationData = async () => {
//     try {
//       const savedData = await AsyncStorage.getItem('savedLocationData');
//       if (savedData) {
//         const parsedData = JSON.parse(savedData);
//         setLocation(parsedData.location || { from: "", to: "", totalDistance: "" });
//         setFromCoords(parsedData.fromCoords);
//         setToCoords(parsedData.toCoords);
//         setRouteCoordinates(parsedData.routeCoordinates || []);
//       }
//     } catch (error) {
//       console.error("Failed to load location data:", error);
//     }
//   };

//   useEffect(() => {
//     if (location.from && location.to && fromCoords && toCoords) {
//       saveLocationData();
//     }
//   }, [location, fromCoords, toCoords, routeCoordinates]);

  
//   useEffect(() => {
//     if (location.from && location.to && fromCoords && toCoords) {
//       saveLocationData();
//     }
//   }, [location, fromCoords, toCoords, routeCoordinates]);
  
//   // 3. Add useFocusEffect to reload data when screen comes into focus again
//   // Modify the useFocusEffect to prioritize current location
// // Modify the useFocusEffect to prioritize current location
// useFocusEffect(
//   React.useCallback(() => {
//     // Load saved location data when screen comes into focus
//     loadLocationData();
    
//     // First check if tracking is active and current position exists
//     if (isTracking && currentPosition) {
//       // Give priority to current location when tracking is active
//       setTimeout(() => {
//         if (mapRef.current) {
//           mapRef.current.animateToRegion({
//             ...currentPosition,
//             latitudeDelta: 0.01,
//             longitudeDelta: 0.01,
//           }, 500);
//         }
//       }, 500);
//     } 
//     // If not tracking but route exists, show the route
//     else if (mapRef.current && routeCoordinates.length > 0) {
//       setTimeout(() => {
//         mapRef.current.fitToCoordinates(routeCoordinates, {
//           edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
//           animated: true,
//         });
//       }, 500);
//     } 
//     // If no route but pickup/dropoff exist, show them
//     else if (mapRef.current && fromCoords && toCoords) {
//       setTimeout(() => {
//         mapRef.current.fitToCoordinates([fromCoords, toCoords], {
//           edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
//           animated: true,
//         });
//       }, 500);
//     }
    
//     return () => {};
//   }, [])
// );

// // Add a useEffect to keep focus on current location when tracking
// useEffect(() => {
//   if (isTracking && currentPosition && mapRef.current) {
//     mapRef.current.animateToRegion(
//       {
//         ...currentPosition,
//         latitudeDelta: 0.01,
//         longitudeDelta: 0.01,
//       },
//       500 // animation duration in ms
//     );
//   }
// }, [currentPosition, isTracking]);

//   return (
//     <SafeAreaView style={styles.container}>
//        <StatusBar  backgroundColor="#0277bd" />
    

//       <View style={styles.header}>
//         <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate("Home")}>
//            <Icon name="chevron-back" size={24} color="#fff" />
//         </TouchableOpacity>
//         <Text style={styles.headerTitle}>Set Location</Text>
//         <View style={{ width: 24 }} />
//       </View>

//       <View style={styles.contentContainer}>
//         <View style={styles.inputsContainer}>
//           <KeyboardAvoidingView 
//             contentContainerStyle={styles.scrollContent}
//             keyboardShouldPersistTaps="handled" // Important for handling touches within the dropdown
//           >
//             <View style={styles.locationsContainer}>
//               {/* Pickup Location */}
//               <View style={styles.locationInputWrapper}>
//                 <View style={[styles.locationCard, validationErrors.from ? styles.errorCard : null]}>
//                   <View style={[styles.iconContainer, styles.pickupIconContainer]}>
//                     <MaterialIcons name="my-location" size={22} color="#fff" />
//                   </View>
//                   <View style={styles.inputContainer}>
//                     <Text style={styles.inputLabel}>Pickup</Text>
//                     <TextInput
//                       placeholder="Enter pickup location"
//                       placeholderTextColor="#9e9e9e"
//                       style={[styles.input, validationErrors.from ? styles.errorInput : null]}
//                       value={location.from}
//                       onFocus={() => setTypingField("from")}
//                       onChangeText={(text) => handleLocationChange("from", text)}
//                     />
//                     {validationErrors.from ? (
//                       <Text style={styles.errorText}>{validationErrors.from}</Text>
//                     ) : null}
//                   </View>
//                 </View>
                
//                 {/* Pickup Location Suggestions */}
//                 {searchResults.length > 0 && typingField === "from" && (
//                   <View style={styles.suggestionsContainer}>
//                     <FlatList
//                       data={searchResults}
//                       keyExtractor={(item) => item.place_id?.toString() || item.osm_id?.toString() || Math.random().toString()}
//                       renderItem={({ item }) => (
//                         <TouchableOpacity
//                           style={styles.suggestionItem}
//                           onPress={() => handleSelectLocation(item)}
//                         >
//                           <MaterialIcons name="place" size={16} color="#666" style={styles.suggestionIcon} />
//                           <Text numberOfLines={2} style={styles.suggestionText}>
//                             {formatLocationName(item.display_name)}
//                           </Text>
//                         </TouchableOpacity>
//                       )}
//                       style={styles.suggestionsList}
//                       nestedScrollEnabled={true}
//                       keyboardShouldPersistTaps="handled"
//                     />
//                   </View>
//                 )}
//               </View>

//               <View style={styles.connector}>
//                 <View style={styles.dottedLine} />
//               </View>

//               {/* Dropoff Location */}
//               <View style={styles.locationInputWrapper}>
//                 <View style={[styles.locationCard, validationErrors.to ? styles.errorCard : null]}>
//                   <View style={[styles.iconContainer, styles.dropoffIconContainer]}>
//                     <MaterialIcons name="location-on" size={22} color="#fff" />
//                   </View>
//                   <View style={styles.inputContainer}>
//                     <Text style={styles.inputLabel}>Drop-off</Text>
//                     <TextInput
//                       placeholder="Enter drop-off location"
//                       placeholderTextColor="#9e9e9e"
//                       style={[styles.input, validationErrors.to ? styles.errorInput : null]}
//                       value={location.to}
//                       onFocus={() => setTypingField("to")}
//                       onChangeText={(text) => handleLocationChange("to", text)}
//                     />
//                     {validationErrors.to ? (
//                       <Text style={styles.errorText}>{validationErrors.to}</Text>
//                     ) : null}
//                   </View>
//                 </View>
                
//                 {/* Dropoff Location Suggestions */}
//                 {searchResults.length > 0 && typingField === "to" && (
//                   <View style={styles.suggestionsContainer}>
//                     <FlatList
//                       data={searchResults}
//                       keyExtractor={(item) => item.place_id?.toString() || item.osm_id?.toString() || Math.random().toString()}
//                       renderItem={({ item }) => (
//                         <TouchableOpacity
//                           style={styles.suggestionItem}
//                           onPress={() => handleSelectLocation(item)}
//                         >
//                           <MaterialIcons name="place" size={16} color="#666" style={styles.suggestionIcon} />
//                           <Text numberOfLines={2} style={styles.suggestionText}>
//                             {formatLocationName(item.display_name)}
//                           </Text>
//                         </TouchableOpacity>
//                       )}
//                       style={styles.suggestionsList}
//                       nestedScrollEnabled={true}
//                       keyboardShouldPersistTaps="handled"
//                     />
//                   </View>
//                 )}
                
//               </View>
//             </View>
//           </KeyboardAvoidingView>
//         </View>

//         <MapView
//           ref={mapRef}
//           provider={PROVIDER_GOOGLE}
//           style={styles.map}
//           region={region}
//           showsUserLocation={false}
//         >
//           {/* Current Position Marker */}
//           {currentPosition && (
//             <Marker
//               coordinate={currentPosition}
//               title="Current Location"
//               description="You are here"
//             >
//               <View style={styles.currentLocationMarker}>
//                 <MaterialIcons name="directions-car" size={24} color="#0277bd" />
//               </View>
//             </Marker>
//           )}
          
//           {/* From Location Marker */}
//           {fromCoords && (
//             <Marker
//               coordinate={fromCoords}
//               title="Pickup Location"
//               description={location.from}
//               pinColor="green"
//             >
//               <View style={styles.fromLocationMarker}>
//                 <MaterialIcons name="location-on" size={24} color="#0277bd" />
//               </View>
//             </Marker>
//           )}
          
//           {/* To Location Marker */}
//           {toCoords && (
//             <Marker
//               coordinate={toCoords}
//               title="Drop-off Location"
//               description={location.to}
//               pinColor="red"
//             >
//               <View style={styles.toLocationMarker}>
//                 <MaterialIcons name="location-on" size={22} color="#fff" />
//               </View>
//             </Marker>
//           )}
          
//           {/* Route Polyline */}
//           {routeCoordinates.length > 0 && (
//             <Polyline
//               coordinates={routeCoordinates}
//               strokeWidth={4}
//               strokeColor="#0277bd"
//             />
//           )}
//         </MapView>

//         {/* WebSocket Connection Status */}
       
         
//       </View>

//       <View style={styles.buttonContainer}>
//         <TouchableOpacity 
//           activeOpacity={0.8} 
//           onPress={handleConfirmLocation} 
//           style={[styles.confirmButton, isTracking ? styles.stopTrackingButton : styles.confirmButton]}
//         >
//           <View style={styles.gradientButton}>
//             <Text style={styles.buttonText}>
//               {isTracking ? "Location Sharing Active" : "Confirm Location"}
//             </Text>
//             <MaterialIcons name={isTracking ? "location-on" : "arrow-forward"} size={20} color="#fff" />
//           </View>
//         </TouchableOpacity>
//       </View>
//     </SafeAreaView>
//   );
// };


// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#f8f9fa",
//   },
//   header: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     backgroundColor: "#0277bd",
//     elevation: 2,
//   },
//   backButton: {
//     padding: 8,
    
//   },
//   headerTitle: {
//     fontSize: 18,
//     fontWeight: "600",
//     color: "#fff",
//   },
//   contentContainer: {
//     flex: 1,
//     display: 'flex',
//     flexDirection: 'column',
//   },
//   inputsContainer: {
//     paddingHorizontal: 16,
//     paddingVertical: 8,
//   },
//   scrollContent: {
//     paddingVertical: 4,
//   },
//   map: { 
//     flex: 1,
//     marginTop: 0, // Remove any margin to close the gap
//   },
//   locationsContainer: {
//     marginVertical: 4, // Reduced vertical margin
//   },
//   locationInputWrapper: {
//     position: 'relative',
//     zIndex: 10, // Ensure the wrapper has a z-index for proper stacking
//   },
//   locationCard: {
//     backgroundColor: "#fff",
//     borderRadius: 8,
//     padding: 12,
//     flexDirection: "row",
//     alignItems: "center",
//     elevation: 2,
//   },
//   errorCard: {
//     borderColor: "#f44336",
//     borderWidth: 1,
//   },
//   iconContainer: {
//     width: 36,
//     height: 36,
//     borderRadius: 18,
//     justifyContent: "center",
//     alignItems: "center",
//     marginRight: 12,
//   },
//   pickupIconContainer: {
//     backgroundColor: "#4caf50",
//   },
//   dropoffIconContainer: {
//     backgroundColor: "#f44336",
//   },
//   inputContainer: {
//     flex: 1,
//   },
//   inputLabel: {
//     fontSize: 12,
//     color: "#757575",
//     marginBottom: 4,
//   },
//   input: {
//     fontSize: 14,
//     color: "#333",
//     padding: 0,
//     marginTop: 2,
//   },
//   errorInput: {
//     color: "#f44336",
//   },
//   errorText: {
//     color: "#f44336",
//     fontSize: 12,
//     marginTop: 4,
//   },
//   connector: {
//     alignItems: "center",
//     marginVertical: 8,
//   },
//   dottedLine: {
//     height: 20,
//     width: 1,
//     backgroundColor: "#bdbdbd",
//   },
//   buttonContainer: {
//     padding: 16,
//     backgroundColor: "#fff",
//     borderTopColor: "#e0e0e0",
//     borderTopWidth: 1,
//   },
//   confirmButton: {
//     overflow: "hidden",
//     borderRadius: 8,
//     elevation: 2,
//   },
//   gradientButton: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: "#0277bd",
//     paddingVertical: 14,
//     borderRadius: 8,
//   },
//   buttonText: {
//     color: "#fff",
//     fontSize: 16,
//     fontWeight: "600",
//     marginRight: 8,
//   },
//   // Suggestion styles
//   suggestionsContainer: {
//     position: 'relative',
//     zIndex: 20,
//     marginTop: 4,
//     marginBottom: 4, // Reduced margin
//   },
//   suggestionsList: {
//     backgroundColor: '#fff',
//     borderRadius: 8,
//     maxHeight: 200,
//     elevation: 4,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.2,
//     shadowRadius: 2,
//   },
//   suggestionItem: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     padding: 12,
//     borderBottomWidth: 1,
//     borderBottomColor: '#e0e0e0',
//   },
//   suggestionIcon: {
//     marginRight: 8,
//   },
//   suggestionText: {
//     flex: 1,
//     fontSize: 14,
//     color: '#333',
//   },
//   // Map marker styles
//   currentLocationMarker: {
//     backgroundColor: "#fff",
//     borderRadius: 50,
//     padding: 6,
//     borderWidth: 2,
//     borderColor: "#0277bd",
//   },
//   fromLocationMarker: {
//     backgroundColor: "#4caf50",
//     borderRadius: 50,
//     padding: 6,
//   },
//   toLocationMarker: {
//     backgroundColor: "#f44336",
//     borderRadius: 50,
//     padding: 6,
//   },
//   statusContainer: {
//     position: 'absolute',
//     top: 10,
//     right: 10,
//     backgroundColor: 'rgba(255, 255, 255, 0.8)',
//     borderRadius: 16,
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//   },
//   statusIndicator: {
//     width: 10,
//     height: 10,
//     borderRadius: 5,
//     marginRight: 6,
//   },
//   connectedIndicator: {
//     backgroundColor: '#4CAF50',
//   },
//   disconnectedIndicator: {
//     backgroundColor: '#F44336',
//   },
//   statusText: {
//     fontSize: 12,
//     fontWeight: '500',
//     color: '#333',
//   },
// });

// export default LocationScreen;


//claude code replace
// import React, { useState, useEffect, useRef } from "react";
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   ScrollView,
//   StatusBar,
//   StyleSheet,
//   SafeAreaView,
//   FlatList,
//   Keyboard,
//   KeyboardAvoidingView
// } from "react-native";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import axios from "react-native-axios";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { PermissionsAndroid, Platform, Alert } from 'react-native';
// import Geolocation from '@react-native-community/geolocation';
// import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
// import Icon from "react-native-vector-icons/Ionicons";
// import { useFocusEffect } from '@react-navigation/native';

// const CACHE_KEY = 'location_suggestions_cache';
// const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// // Popular Indian cities for instant suggestions
// const POPULAR_CITIES = [
//   { display_name: "Mumbai, Maharashtra, India", lat: "19.076", lon: "72.8777", place_id: "mumbai" },
//   { display_name: "Delhi, India", lat: "28.6139", lon: "77.2090", place_id: "delhi" },
//   { display_name: "Bangalore, Karnataka, India", lat: "12.9716", lon: "77.5946", place_id: "bangalore" },
//   { display_name: "Hyderabad, Telangana, India", lat: "17.3850", lon: "78.4867", place_id: "hyderabad" },
//   { display_name: "Chennai, Tamil Nadu, India", lat: "13.0827", lon: "80.2707", place_id: "chennai" },
//   { display_name: "Kolkata, West Bengal, India", lat: "22.5726", lon: "88.3639", place_id: "kolkata" },
//   { display_name: "Pune, Maharashtra, India", lat: "18.5204", lon: "73.8567", place_id: "pune" },
//   { display_name: "Ahmedabad, Gujarat, India", lat: "23.0225", lon: "72.5714", place_id: "ahmedabad" },
//   { display_name: "Jaipur, Rajasthan, India", lat: "26.9124", lon: "75.7873", place_id: "jaipur" },
//   { display_name: "Surat, Gujarat, India", lat: "21.1702", lon: "72.8311", place_id: "surat" }
// ];

// const LocationScreen = ({ navigation }) => {
//   const [cabNumber, setCabNumber] = useState("");
//   const [error, setError] = useState("");
//   const [location, setLocation] = useState({ from: "", to: "", totalDistance: "" });
//   const [validationErrors, setValidationErrors] = useState({ from: "", to: "" });
//   const [formSubmitted, setFormSubmitted] = useState(false);
//   const [searchResults, setSearchResults] = useState([]);
//   const [typingField, setTypingField] = useState(""); 
//   const [keyboardVisible, setKeyboardVisible] = useState(false);
//   const wsRef = useRef(null);
  
//   const mapRef = useRef(null);
//   const [region, setRegion] = useState(null);
//   const [currentPosition, setCurrentPosition] = useState(null);
//   const [currentPositionAdd, setcurrentPositionAdd] = useState(null)
//   const [fromCoords, setFromCoords] = useState(null);
//   const [toCoords, setToCoords] = useState(null);
//   const [routeCoordinates, setRouteCoordinates] = useState([]);
//   const watchPositionRef = useRef(null);
//   const [driverId, setDriverId] = useState("")
  
//   const webSocketRef = useRef(null);
//   const [isConnected, setIsConnected] = useState(false);
//   const [isTracking, setIsTracking] = useState(false);
 
//   const [suggestionCache, setSuggestionCache] = useState(new Map());
//   const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
//   const currentRequestRef = useRef(null);

//   const previousPosition = useRef(null);
  
//   // Updated server URL - make sure this matches your PostgreSQL backend
//   const SERVER_URL = "http://192.168.1.47:5000"; // Updated to match your new URL
//   const WS_URL = "ws://192.168.1.47:5000";
 
//   const getCacheKey = (query) => `${CACHE_KEY}_${query.toLowerCase().trim()}`;

//   const getCachedSuggestions = async (query) => {
//     try {
//       const cacheKey = getCacheKey(query);
//       const cached = await AsyncStorage.getItem(cacheKey);
      
//       if (cached) {
//         const { data, timestamp } = JSON.parse(cached);
//         const now = Date.now();
        
//         if (now - timestamp < CACHE_EXPIRY) {
//           return data;
//         } else {
//           // Remove expired cache
//           AsyncStorage.removeItem(cacheKey);
//         }
//       }
//     } catch (error) {
//       console.error('Error getting cached suggestions:', error);
//     }
//     return null;
//   };

//   const setCachedSuggestions = async (query, data) => {
//     try {
//       const cacheKey = getCacheKey(query);
//       const cacheData = {
//         data,
//         timestamp: Date.now()
//       };
//       await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
//     } catch (error) {
//       console.error('Error caching suggestions:', error);
//     }
//   };

//   // Fast local search function
//   const getInstantSuggestions = (query) => {
//     const lowerQuery = query.toLowerCase().trim();
    
//     if (lowerQuery.length < 1) return [];
    
//     return POPULAR_CITIES.filter(city => 
//       city.display_name.toLowerCase().includes(lowerQuery)
//     );
//   };

//   // Add this function to preload popular cities cache
//   const preloadPopularCities = async () => {
//     try {
//       for (const city of POPULAR_CITIES.slice(0, 5)) { // Preload top 5 cities
//         const cacheKey = getCacheKey(city.display_name.split(',')[0]);
//         const exists = await AsyncStorage.getItem(cacheKey);
        
//         if (!exists) {
//           await setCachedSuggestions(city.display_name.split(',')[0], [city]);
//         }
//       }
//     } catch (error) {
//       console.error('Error preloading cities:', error);
//     }
//   };

//   useEffect(() => {
//     const keyboardDidShowListener = Keyboard.addListener(
//       'keyboardDidShow',
//       () => {
//         setKeyboardVisible(true);
//       }
//     );
//     const keyboardDidHideListener = Keyboard.addListener(
//       'keyboardDidHide',
//       () => {
//         setKeyboardVisible(false);
//       }
//     );

//     return () => {
//       keyboardDidShowListener.remove();
//       keyboardDidHideListener.remove();
//     };
//   }, []);

//   useEffect(() => {
//     const getDriverId = async () => {
//       try {
//         const userId = await AsyncStorage.getItem("userid");
//         setDriverId(userId)
//       } catch (error) {
//         console.error("Error getting driver ID:", error);
//       }
//     };
    
//     getDriverId();
//     preloadPopularCities();
    
//     return () => {
//       closeWebSocketConnection();
//     };
//   }, []);

//   useEffect(() => {
//     startLocationTracking();
    
//     // Clean up location tracking when component unmounts
//     return () => {
//       if (watchPositionRef.current !== null) {
//         Geolocation.clearWatch(watchPositionRef.current);
//       }
//     };
//   }, []);

//   useEffect(() => {
//     if (fromCoords && toCoords) {
//       fetchRoute(fromCoords, toCoords);
//     }
//   }, [fromCoords, toCoords]);

//   useEffect(() => {
//     if (isTracking && isConnected && currentPosition && driverId) {
//       sendLocationUpdate();
      
//       // Set up interval for continuous location updates
//       const intervalId = setInterval(() => {
//         if (isTracking && isConnected && currentPosition) {
//           sendLocationUpdate();
//         }
//       }, 10000); // Send updates every 10 seconds
      
//       return () => clearInterval(intervalId);
//     }
//   }, [currentPosition, isTracking, isConnected]);

//   useEffect(() => {
//     initializeWebSocket();
//     return () => {
//       webSocketRef.current?.close();
//     };
//   }, []);

//   //mapmarker center
//   useEffect(() => {
//     if (currentPosition && mapRef.current) {
//       mapRef.current.animateToRegion(
//         {
//           ...currentPosition,
//           latitudeDelta: 0.01,
//           longitudeDelta: 0.01,
//         },
//         500 // animation duration in ms
//       );
//     }
//   }, [currentPosition]);

//   const initializeWebSocket = async () => {
//     try {
//       // Close existing connection if any
//       if (webSocketRef.current) {
//         webSocketRef.current.close();
//       }
      
//       webSocketRef.current = new WebSocket(WS_URL);
      
//       webSocketRef.current.onopen = () => {
//         setIsConnected(true);
        
//         // Only register if we have a driver ID
//         if (driverId) {
//           const registerMsg = {
//             type: 'register',
//             driverId: driverId,
//             role: 'driver',
//           };
//           webSocketRef.current.send(JSON.stringify(registerMsg));
//         }
//       };
      
//       webSocketRef.current.onclose = (event) => {
//         setIsConnected(false);
        
//         // Try to reconnect after a delay if component is still mounted
//         setTimeout(() => {
//           if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.CLOSED) {
//             initializeWebSocket();
//           }
//         }, 5000);
//       };
      
//       webSocketRef.current.onerror = (error) => {
//         console.error("WebSocket error:", error);
//       };
      
//       webSocketRef.current.onmessage = (event) => {
//         try {
//           const data = JSON.parse(event.data);
          
//           // Handle incoming messages
//           switch (data.type) {
//             case "location":
//               sendLocationUpdate();
//               break;
//             case "register_confirmation":
//               console.log("Driver registered successfully");
//               break;
//             case "ERROR":
//               Alert.alert("Server Error", data.payload?.message || "Unknown server error");
//               break;
//             default:
//               console.log("Unhandled message type:", data.type);
//           }
//         } catch (error) {
//           console.error("Error parsing WebSocket message:", error);
//         }
//       };
//     } catch (error) {
//       console.error("Error initializing WebSocket:", error);
//     }
//   };

//   // Close WebSocket connection
//   const closeWebSocketConnection = () => {
//     if (webSocketRef.current) {
//       if (webSocketRef.current.readyState === WebSocket.OPEN) {
//         const disconnectMessage = {
//           type: "DRIVER_DISCONNECT",
//           payload: {
//             driverId: driverId,
//             cabNumber
//           }
//         };
        
//         try {
//           webSocketRef.current.send(JSON.stringify(disconnectMessage));
//         } catch (error) {
//           console.error("Error sending disconnect message:", error);
//         }
//       }
      
//       setIsTracking(false);
//       webSocketRef.current.close();
//       setIsConnected(false);
//     }
//   };

//   const sendLocationUpdate = () => {
//     if (!webSocketRef.current || webSocketRef.current.readyState !== WebSocket.OPEN) {
//       return;
//     }
    
//     if (!currentPosition) {
//       return;
//     }
    
//     if (!driverId) {
//       return;
//     }
    
//     try {
//       const locationData = {
//         type: "location",
//         driverId: driverId,
//         role: "driver",
//         location: {
//           latitude: currentPosition.latitude,
//           longitude: currentPosition.longitude,
//           timestamp: new Date().toISOString(),
//           from: location.from,
//           to: location.to
//         }
//       };
//       console.log("Sending location:", currentPosition.latitude, currentPosition.longitude);
      
//       webSocketRef.current.send(JSON.stringify(locationData));
//     } catch (error) {
//       console.error("Error sending location update:", error);
//     }
//   };

//   // Calculate bearing angle for vehicle direction on map
//   const calculateBearingAngle = () => {
//     // If we have previous position, calculate the bearing angle
//     if (previousPosition.current && currentPosition) {
//       const { latitude: lat1, longitude: lon1 } = previousPosition.current;
//       const { latitude: lat2, longitude: lon2 } = currentPosition;
      
//       const toRad = (value) => (value * Math.PI) / 180;
//       const toDeg = (value) => (value * 180) / Math.PI;
      
//       const dLon = toRad(lon2 - lon1);
//       const y = Math.sin(dLon) * Math.cos(toRad(lat2));
//       const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
//               Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
              
//       let brng = toDeg(Math.atan2(y, x));
//       brng = (brng + 360) % 360;
      
//       return brng;
//     }
//     // Default angle if we don't have previous positions
//     return 0;
//   };

//   const requestLocationPermission = async () => {
//     if (Platform.OS === 'ios') {
//       const status = await Geolocation.requestAuthorization('whenInUse');
//       return status === 'granted';
//     } else {
//       const granted = await PermissionsAndroid.request(
//         PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
//       );
//       return granted === PermissionsAndroid.RESULTS.GRANTED;
//     }
//   };

//   const reverseGeocodeLocation = async (lat, lon) => {
//     try {
//       const response = await fetch(
//         `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
//       );
//       const data = await response.json();
  
//       if (data?.display_name) {
//         // Only set if user hasn't typed anything yet
//         setLocation(prev => {
//           if (!prev.from) {
//             return { ...prev, from: data.display_name };
//           }
//           return prev; // user already typed, don't overwrite
//         });
//       }
//     } catch (err) {
//       console.error("Error reverse geocoding:", err);
//     }
//   };

//   // Start tracking user's location
//   const startLocationTracking = async () => {
//     try {
//       const hasPermission = await requestLocationPermission();
      
//       if (!hasPermission) {
//         Alert.alert('Permission Denied', 'Location permission is required to track position.');
//         return;
//       }
      
//       // Function to use last known or default position
//       const useLastKnownOrDefaultPosition = async () => {
//         try {
//           // Try to get last position from storage
//           const lastPositionJson = await AsyncStorage.getItem('lastKnownPosition');
//           if (lastPositionJson) {
//             const lastPosition = JSON.parse(lastPositionJson);
//             setCurrentPosition(lastPosition);
//             previousPosition.current = lastPosition;
//             setRegion({
//               latitude: lastPosition.latitude,
//               longitude: lastPosition.longitude,
//               latitudeDelta: 0.01,
//               longitudeDelta: 0.01,
//             });
//             return;
//           }
//         } catch (error) {
//           console.error("Error getting last position:", error);
//         }
        
//         // Fall back to a default position (e.g., center of a major city in India)
//         // Using Delhi as a default example
//         const defaultPosition = { latitude: 28.6139, longitude: 77.2090 };
//         setCurrentPosition(defaultPosition);
//         previousPosition.current = defaultPosition;
//         setRegion({
//           latitude: defaultPosition.latitude,
//           longitude: defaultPosition.longitude,
//           latitudeDelta: 0.05,
//           longitudeDelta: 0.05,
//         });
//       };
      
//       // Function to get initial position with retry capability
//       const getInitialPosition = (retryCount = 0) => {
//         Geolocation.getCurrentPosition(
//           (position) => {
//             const { latitude, longitude, accuracy } = position.coords;
            
//             const initialPosition = { latitude, longitude };
//             setCurrentPosition(initialPosition);
//             previousPosition.current = initialPosition;
//             setRegion({
//               latitude,
//               longitude,
//               latitudeDelta: 0.01,
//               longitudeDelta: 0.01,
//             });
            
//             // Save this position for future use
//             try {
//               AsyncStorage.setItem('lastKnownPosition', JSON.stringify(initialPosition));
//             } catch (error) {
//               console.error("Error saving position:", error);
//             }
            
//             // Continue with setting up the watcher after getting initial position
//             setupPositionWatcher();
//           },
//           (error) => {
//             console.error("Error getting initial position:", error);
            
//             // Handle timeout specifically
//             if (error.code === 3) { // TIMEOUT
//               if (retryCount < 3) {
//                 setTimeout(() => getInitialPosition(retryCount + 1), 2000);
//               } else {
//                 useLastKnownOrDefaultPosition().then(() => {
//                   setupPositionWatcher();
//                 });
//               }
//             } else {
//               Alert.alert(
//                 'Location Error', 
//                 `Could not get your position: ${error.message}`,
//                 [{ text: 'OK', onPress: () => {
//                   useLastKnownOrDefaultPosition().then(() => {
//                     setupPositionWatcher();
//                   });
//                 }}]
//               );
//             }
//           },
//           { 
//             enableHighAccuracy: false, // Start with false for faster response
//             timeout: 30000,           // Increased timeout to 30 seconds
//             maximumAge: 60000         // Allow positions up to 1 minute old
//           }
//         );
//       };
  
//       // Separate function to set up the position watcher
//       const setupPositionWatcher = () => {
//         // Clear any existing watchers to prevent duplicates
//         if (watchPositionRef.current !== null) {
//           Geolocation.clearWatch(watchPositionRef.current);
//         }
        
//         // Watch position for updates with more detailed settings and logging
//         watchPositionRef.current = Geolocation.watchPosition(
//           (position) => {
//             const { latitude, longitude, accuracy, speed, heading } = position.coords;
//             const timestamp = new Date(position.timestamp).toISOString();
            
//             const newPosition = { latitude, longitude };
//             setCurrentPosition(newPosition);
            
//             // Save this position for future use
//             try {
//               AsyncStorage.setItem('lastKnownPosition', JSON.stringify(newPosition));
//             } catch (error) {
//               console.error("Error saving new position:", error);
//             }
//           },
//           (error) => {
//             console.error("Error watching position:", error);
            
//             // If watching position fails, let's still use what we have
//             if (currentPosition) {
//               console.log("Using existing position");
//             }
//           },
//           { 
//             enableHighAccuracy: true, 
//             distanceFilter: 1,    // Updates when device moves 1 meters
//             interval: 5000,        // Android: Try to update every 5 seconds
//             fastestInterval: 2000, // Android: Fastest rate app can handle updates
//             timeout: 60000         // Long timeout for watching
//           }
//         );
//       };
      
//       // Start the process
//       getInitialPosition();
      
//     } catch (error) {
//       Alert.alert('Error', 'Failed to start location tracking: ' + error.message);
//     }
//   };

//   // Convert address to coordinates
//   const geocodeAddress = async (address, locationType) => {
//     try {
//       const response = await fetch(
//         `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=in`
//       );
//       const data = await response.json();
      
//       if (data && data.length > 0) {
//         const { lat, lon } = data[0];
//         const coordinates = { latitude: parseFloat(lat), longitude: parseFloat(lon) };
        
//         if (locationType === 'from') {
//           setFromCoords(coordinates);
//         } else if (locationType === 'to') {
//           setToCoords(coordinates);
//         }
        
//         return coordinates;
//       }
//       return null;
//     } catch (error) {
//       console.error("Error geocoding address:", error);
//       return null;
//     }
//   };

//   // Fetch route between two coordinates
//   const fetchRoute = async (start, end) => {
//     try {
//       const response = await fetch(
//         `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`
//       );
//       const data = await response.json();
      
//       if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
//         const routeGeometry = data.routes[0].geometry;
//         const coords = routeGeometry.coordinates.map(([lng, lat]) => ({
//           latitude: lat,
//           longitude: lng,
//         }));
        
//         setRouteCoordinates(coords);
        
//         // Fit map to show entire route
//         if (mapRef.current && coords.length > 0) {
//           mapRef.current.fitToCoordinates(coords, {
//             edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
//             animated: true,
//           });
//         }
//       }
//     } catch (error) {
//       console.error("Error fetching route:", error);
//     }
//   };

//   useEffect(() => {
//     const fetchSuggestions = async () => {
//       const query = typingField ? location[typingField] : "";
//       const trimmedQuery = query.trim();
      
//       if (trimmedQuery.length < 2) {
//         setSearchResults([]);
//         return;
//       }

//       // Cancel previous request
//       if (currentRequestRef.current) {
//         currentRequestRef.current.abort();
//       }

//       setIsLoadingSuggestions(true);
      
//       try {
//         // Step 1: Show instant suggestions immediately
//         const instantResults = getInstantSuggestions(trimmedQuery);
//         if (instantResults.length > 0) {
//           setSearchResults(instantResults);
//         } else {
//           setSearchResults([{ display_name: "Searching...", place_id: "loading" }]);
//         }

//         // Step 2: Check cache
//         const cachedResults = await getCachedSuggestions(trimmedQuery);
//         if (cachedResults && cachedResults.length > 0) {
//           setSearchResults(cachedResults);
//           setIsLoadingSuggestions(false);
//           return;
//         }

//         // Step 3: Make API call only if no cache found
//         const controller = new AbortController();
//         currentRequestRef.current = controller;
        
//         const timeoutId = setTimeout(() => controller.abort(), 8000);
        
//         const response = await fetch(
//           `https://nominatim.openstreetmap.org/search?` +
//           `q=${encodeURIComponent(trimmedQuery)}` +
//           `&format=json` +
//           `&limit=8` +
//           `&countrycodes=in` +
//           `&addressdetails=1` +
//           `&bounded=1` +
//           `&dedupe=1`,
//           { 
//             signal: controller.signal
//           }
//         );
        
//         clearTimeout(timeoutId);
        
//         if (controller.signal.aborted) {
//           return;
//         }
        
//         const data = await response.json();
        
//         // Filter and sort results
//         const filteredResults = data
//           .filter(item => {
//             const displayName = item.display_name.toLowerCase();
//             const searchQuery = trimmedQuery.toLowerCase();
//             return displayName.includes(searchQuery);
//           })
//           .sort((a, b) => {
//             const aSpecificity = (a.address?.house_number ? 3 : 0) + 
//                                 (a.address?.road ? 2 : 0) + 
//                                 (a.address?.neighbourhood ? 1 : 0);
//             const bSpecificity = (b.address?.house_number ? 3 : 0) + 
//                                 (b.address?.road ? 2 : 0) + 
//                                 (b.address?.neighbourhood ? 1 : 0);
//             return bSpecificity - aSpecificity;
//           })
//           .slice(0, 6);
        
//         // Combine instant results with API results, removing duplicates
//         const combinedResults = [...instantResults];
//         filteredResults.forEach(apiResult => {
//           const exists = combinedResults.some(existing => 
//             existing.display_name.toLowerCase() === apiResult.display_name.toLowerCase()
//           );
//           if (!exists) {
//             combinedResults.push(apiResult);
//           }
//         });
        
//         const finalResults = combinedResults.slice(0, 8);
//         setSearchResults(finalResults);
        
//         // Cache the results for future use
//         if (finalResults.length > 0) {
//           setCachedSuggestions(trimmedQuery, finalResults);
//         }
        
//       } catch (error) {
//         if (error.name !== 'AbortError') {
//           console.error("Error fetching location suggestions:", error);
//           // Fallback to instant suggestions only
//           const instantResults = getInstantSuggestions(trimmedQuery);
//           setSearchResults(instantResults);
//         }
//       } finally {
//         setIsLoadingSuggestions(false);
//         currentRequestRef.current = null;
//       }
//     };

//     if (!typingField) {
//       setSearchResults([]);
//       return;
//     }

//     const query = location[typingField];
    
//     if (!query || query.length < 2) {
//       setSearchResults([]);
//       return;
//     }

//     // Immediate response for short queries
//     if (query.length < 3) {
//       const instantResults = getInstantSuggestions(query);
//       setSearchResults(instantResults);
//       return;
//     }

//     // Debounced API call for longer queries
//     const debounceTimeout = setTimeout(() => {
//       fetchSuggestions();
//     }, 300); // Reduced debounce time

//     return () => {
//       clearTimeout(debounceTimeout);
//     };
//   }, [location.from, location.to, typingField]);

//   useEffect(() => {
//     getCab();
//   }, []);

//   // Updated getCab function for PostgreSQL backend
//   const getCab = async () => {
//     try {
//       const token = await AsyncStorage.getItem("userToken");
//       if (token) {
//         const response = await axios.get(`${SERVER_URL}/api/assignCab/driver`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });
        
//         // Updated for PostgreSQL response structure
//         if (response.data && response.data.length > 0) {
//           const assignmentData = response.data[0];
//           // Check if cab data exists in the assignment
//           if (assignmentData.cab && assignmentData.cab.cabNumber) {
//             setCabNumber(assignmentData.cab.cabNumber);
//           } else if (assignmentData.cabNumber) {
//             // Fallback if cab number is directly in assignment
//             setCabNumber(assignmentData.cabNumber);
//           }
//         }
//       }
//     } catch (error) {
//       console.error("Error fetching cab data:", error);
//       Alert.alert("Error", "Failed to fetch assigned cab data");
//     }
//   };

//   const validateInputs = () => {
//     const errors = { from: "", to: "" };
//     let isValid = true;

//     if (!location.from.trim()) {
//       errors.from = "Pickup location is required";
//       isValid = false;
//     }

//     if (!location.to.trim()) {
//       errors.to = "Drop-off location is required";
//       isValid = false;
//     }

//     setValidationErrors(errors);
//     return isValid;
//   };

//   const handleLocationChange = (field, value) => {
//     setLocation((prev) => ({ ...prev, [field]: value }));

//     if (formSubmitted) {
//       setValidationErrors((prev) => ({
//         ...prev,
//         [field]: value.trim() ? "" : `${field === "from" ? "Pickup" : "Drop-off"} location is required`,
//       }));
//     }
//   };

//   const handleSelectLocation = async (item) => {
//     if (typingField && item.place_id !== "loading") {
//       // Clear suggestions immediately
//       setSearchResults([]);
//       setIsLoadingSuggestions(false);
      
//       // Cancel any ongoing request
//       if (currentRequestRef.current) {
//         currentRequestRef.current.abort();
//       }
      
//       // Extract address
//       const address = item.display_name.split(', India')[0];
//       handleLocationChange(typingField, address);
      
//       // Set coordinates
//       const lat = parseFloat(item.lat);
//       const lon = parseFloat(item.lon);
//       const coords = { latitude: lat, longitude: lon };
      
//       if (typingField === 'from') {
//         setFromCoords(coords);
//       } else if (typingField === 'to') {
//         setToCoords(coords);
//       }
      
//       // Clear typing field
//       setTypingField("");
      
//       // Save data
//       setTimeout(() => {
//         saveLocationData();
//       }, 100);
//     }
//   };

//   const watchId = useRef(null);

//   // Updated handleConfirmLocation function for PostgreSQL backend
//   const handleConfirmLocation = async () => {
//     setFormSubmitted(true);
  
//     if (!validateInputs()) {
//       return;
//     }
  
//     if (cabNumber) {
//       try {
//         const token = await AsyncStorage.getItem("userToken");
        
//         // Updated payload structure for PostgreSQL backend
//         const locationData = {
//           locationFrom: location.from,
//           locationTo: location.to
//         };

//         console.log("Sending location data:", locationData);

//         const response = await axios.patch(
//           `${SERVER_URL}/api/assigncab/update-trip`,
//           locationData, // Send as JSON, not FormData
//           {
//             headers: {
//               "Content-Type": "application/json", // Changed from multipart/form-data
//               Authorization: `Bearer ${token}`,
//             },
//           }
//         );

//         if (response.status === 200) {
//           console.log("Trip update response:", response.data);
          
//           // Save the location data explicitly here
//           await saveLocationData();

//           Alert.alert("Success", "Location submitted successfully!", [
//             {
//               text: "OK",
//             },
//           ]);
//           setIsTracking(true);

//           // Start sending location updates via WebSocket
//           if (isConnected) {
//             sendLocationUpdate();

//             // Set up interval for continuous updates
//             const intervalId = setInterval(() => {
//               if (isTracking && isConnected) {
//                 sendLocationUpdate();
//               } else {
//                 clearInterval(intervalId);
//               }
//             }, 10000);
//           } else {
//             Alert.alert("Warning", "WebSocket not connected. Location tracking may not work properly.");
//             initializeWebSocket(); // Try to reconnect
//           }
//         }
//       } catch (error) {
//         console.error("Error submitting location:", error);
//         if (error.response) {
//           console.error("Error response:", error.response.data);
//           Alert.alert("Error", `Failed to submit location: ${error.response.data.message || 'Unknown error'}`);
//         } else {
//           Alert.alert("Error", "Failed to submit location information.");
//         }
//       }
//     } else {
//       Alert.alert("Error", "No cab assigned to you");
//     }

//     Keyboard.dismiss();
//   };

//   const formatLocationName = (displayName) => {
//     // Extract just the relevant part of the address for India
//     const parts = displayName.split(', ');
//     // Keep only the first 3-4 parts or until we find state/district names
//     const relevantParts = parts.slice(0, Math.min(4, parts.length));
//     return relevantParts.join(', ');
//   };

//   const saveLocationData = async () => {
//     try {
//       if (location.from && location.to) {
//         const locationData = {
//           location,
//           fromCoords,
//           toCoords,
//           routeCoordinates
//         };
//         await AsyncStorage.setItem('savedLocationData', JSON.stringify(locationData));
//         console.log("Location data saved successfully");
//       }
//     } catch (error) {
//       console.error("Failed to save location data:", error);
//     }
//   };

//   const loadLocationData = async () => {
//     try {
//       const savedData = await AsyncStorage.getItem('savedLocationData');
//       if (savedData) {
//         const parsedData = JSON.parse(savedData);
//         setLocation(parsedData.location || { from: "", to: "", totalDistance: "" });
//         setFromCoords(parsedData.fromCoords);
//         setToCoords(parsedData.toCoords);
//         setRouteCoordinates(parsedData.routeCoordinates || []);
//         console.log("Location data loaded successfully");
//       }
//     } catch (error) {
//       console.error("Failed to load location data:", error);
//     }
//   };

//   useEffect(() => {
//     if (location.from && location.to && fromCoords && toCoords) {
//       saveLocationData();
//     }
//   }, [location, fromCoords, toCoords, routeCoordinates]);

//   // Add useFocusEffect to reload data when screen comes into focus again
//   useFocusEffect(
//     React.useCallback(() => {
//       // Load saved location data when screen comes into focus
//       loadLocationData();
      
//       // First check if tracking is active and current position exists
//       if (isTracking && currentPosition) {
//         // Give priority to current location when tracking is active
//         setTimeout(() => {
//           if (mapRef.current) {
//             mapRef.current.animateToRegion({
//               ...currentPosition,
//               latitudeDelta: 0.01,
//               longitudeDelta: 0.01,
//             }, 500);
//           }
//         }, 500);
//       } 
//       // If not tracking but route exists, show the route
//       else if (mapRef.current && routeCoordinates.length > 0) {
//         setTimeout(() => {
//           mapRef.current.fitToCoordinates(routeCoordinates, {
//             edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
//             animated: true,
//           });
//         }, 500);
//       } 
//       // If no route but pickup/dropoff exist, show them
//       else if (mapRef.current && fromCoords && toCoords) {
//         setTimeout(() => {
//           mapRef.current.fitToCoordinates([fromCoords, toCoords], {
//             edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
//             animated: true,
//           });
//         }, 500);
//       }
      
//       return () => {};
//     }, [isTracking, currentPosition, routeCoordinates, fromCoords, toCoords])
//   );

//   // Add a useEffect to keep focus on current location when tracking
//   useEffect(() => {
//     if (isTracking && currentPosition && mapRef.current) {
//       mapRef.current.animateToRegion(
//         {
//           ...currentPosition,
//           latitudeDelta: 0.01,
//           longitudeDelta: 0.01,
//         },
//         500 // animation duration in ms
//       );
//     }
//   }, [currentPosition, isTracking]);

//   return (
//     <SafeAreaView style={styles.container}>
//       <StatusBar backgroundColor="#0277bd" />

//       <View style={styles.header}>
//         <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate("Home")}>
//           <Icon name="chevron-back" size={24} color="#fff" />
//         </TouchableOpacity>
//         <Text style={styles.headerTitle}>Set Location</Text>
//         <View style={{ width: 24 }} />
//       </View>

//       <View style={styles.contentContainer}>
//         <View style={styles.inputsContainer}>
//           <KeyboardAvoidingView 
//             contentContainerStyle={styles.scrollContent}
//             keyboardShouldPersistTaps="handled"
//           >
//             <View style={styles.locationsContainer}>
//               {/* Pickup Location */}
//               <View style={styles.locationInputWrapper}>
//                 <View style={[styles.locationCard, validationErrors.from ? styles.errorCard : null]}>
//                   <View style={[styles.iconContainer, styles.pickupIconContainer]}>
//                     <MaterialIcons name="my-location" size={22} color="#fff" />
//                   </View>
//                   <View style={styles.inputContainer}>
//                     <Text style={styles.inputLabel}>Pickup</Text>
//                     <TextInput
//                       placeholder="Enter pickup location"
//                       placeholderTextColor="#9e9e9e"
//                       style={[styles.input, validationErrors.from ? styles.errorInput : null]}
//                       value={location.from}
//                       onFocus={() => setTypingField("from")}
//                       onChangeText={(text) => handleLocationChange("from", text)}
//                     />
//                     {validationErrors.from ? (
//                       <Text style={styles.errorText}>{validationErrors.from}</Text>
//                     ) : null}
//                   </View>
//                 </View>
                
//                 {/* Pickup Location Suggestions */}
//                 {searchResults.length > 0 && typingField === "from" && (
//                   <View style={styles.suggestionsContainer}>
//                     <FlatList
//                       data={searchResults}
//                       keyExtractor={(item) => item.place_id?.toString() || item.osm_id?.toString() || Math.random().toString()}
//                       renderItem={({ item }) => (
//                         <TouchableOpacity
//                           style={styles.suggestionItem}
//                           onPress={() => handleSelectLocation(item)}
//                         >
//                           <MaterialIcons name="place" size={16} color="#666" style={styles.suggestionIcon} />
//                           <Text numberOfLines={2} style={styles.suggestionText}>
//                             {formatLocationName(item.display_name)}
//                           </Text>
//                         </TouchableOpacity>
//                       )}
//                       style={styles.suggestionsList}
//                       nestedScrollEnabled={true}
//                       keyboardShouldPersistTaps="handled"
//                     />
//                   </View>
//                 )}
//               </View>

//               <View style={styles.connector}>
//                 <View style={styles.dottedLine} />
//               </View>

//               {/* Dropoff Location */}
//               <View style={styles.locationInputWrapper}>
//                 <View style={[styles.locationCard, validationErrors.to ? styles.errorCard : null]}>
//                   <View style={[styles.iconContainer, styles.dropoffIconContainer]}>
//                     <MaterialIcons name="location-on" size={22} color="#fff" />
//                   </View>
//                   <View style={styles.inputContainer}>
//                     <Text style={styles.inputLabel}>Drop-off</Text>
//                     <TextInput
//                       placeholder="Enter drop-off location"
//                       placeholderTextColor="#9e9e9e"
//                       style={[styles.input, validationErrors.to ? styles.errorInput : null]}
//                       value={location.to}
//                       onFocus={() => setTypingField("to")}
//                       onChangeText={(text) => handleLocationChange("to", text)}
//                     />
//                     {validationErrors.to ? (
//                       <Text style={styles.errorText}>{validationErrors.to}</Text>
//                     ) : null}
//                   </View>
//                 </View>
                
//                 {/* Dropoff Location Suggestions */}
//                 {searchResults.length > 0 && typingField === "to" && (
//                   <View style={styles.suggestionsContainer}>
//                     <FlatList
//                       data={searchResults}
//                       keyExtractor={(item) => item.place_id?.toString() || item.osm_id?.toString() || Math.random().toString()}
//                       renderItem={({ item }) => (
//                         <TouchableOpacity
//                           style={styles.suggestionItem}
//                           onPress={() => handleSelectLocation(item)}
//                         >
//                           <MaterialIcons name="place" size={16} color="#666" style={styles.suggestionIcon} />
//                           <Text numberOfLines={2} style={styles.suggestionText}>
//                             {formatLocationName(item.display_name)}
//                           </Text>
//                         </TouchableOpacity>
//                       )}
//                       style={styles.suggestionsList}
//                       nestedScrollEnabled={true}
//                       keyboardShouldPersistTaps="handled"
//                     />
//                   </View>
//                 )}
//               </View>
//             </View>
//           </KeyboardAvoidingView>
//         </View>

//         <MapView
//           ref={mapRef}
//           provider={PROVIDER_GOOGLE}
//           style={styles.map}
//           region={region}
//           showsUserLocation={false}
//         >
//           {/* Current Position Marker */}
//           {currentPosition && (
//             <Marker
//               coordinate={currentPosition}
//               title="Current Location"
//               description="You are here"
//             >
//               <View style={styles.currentLocationMarker}>
//                 <MaterialIcons name="directions-car" size={24} color="#0277bd" />
//               </View>
//             </Marker>
//           )}
          
//           {/* From Location Marker */}
//           {fromCoords && (
//             <Marker
//               coordinate={fromCoords}
//               title="Pickup Location"
//               description={location.from}
//               pinColor="green"
//             >
//               <View style={styles.fromLocationMarker}>
//                 <MaterialIcons name="location-on" size={24} color="#0277bd" />
//               </View>
//             </Marker>
//           )}
          
//           {/* To Location Marker */}
//           {toCoords && (
//             <Marker
//               coordinate={toCoords}
//               title="Drop-off Location"
//               description={location.to}
//               pinColor="red"
//             >
//               <View style={styles.toLocationMarker}>
//                 <MaterialIcons name="location-on" size={22} color="#fff" />
//               </View>
//             </Marker>
//           )}
          
//           {/* Route Polyline */}
//           {routeCoordinates.length > 0 && (
//             <Polyline
//               coordinates={routeCoordinates}
//               strokeWidth={4}
//               strokeColor="#0277bd"
//             />
//           )}
//         </MapView>

//         {/* WebSocket Connection Status - Optional for debugging */}
//         {__DEV__ && (
//           <View style={styles.statusContainer}>
//             <View style={[
//               styles.statusIndicator, 
//               isConnected ? styles.connectedIndicator : styles.disconnectedIndicator
//             ]} />
//             <Text style={styles.statusText}>
//               {isConnected ? 'Connected' : 'Disconnected'}
//             </Text>
//           </View>
//         )}
//       </View>

//       <View style={styles.buttonContainer}>
//         <TouchableOpacity 
//           activeOpacity={0.8} 
//           onPress={handleConfirmLocation} 
//           style={[styles.confirmButton, isTracking ? styles.trackingActiveButton : styles.confirmButton]}
//         >
//           <View style={[
//             styles.gradientButton,
//             isTracking ? styles.trackingActiveGradient : styles.gradientButton
//           ]}>
//             <Text style={styles.buttonText}>
//               {isTracking ? "Location Sharing Active" : "Confirm Location"}
//             </Text>
//             <MaterialIcons 
//               name={isTracking ? "location-on" : "arrow-forward"} 
//               size={20} 
//               color="#fff" 
//             />
//           </View>
//         </TouchableOpacity>
//       </View>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#f8f9fa",
//   },
//   header: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     backgroundColor: "#0277bd",
//     elevation: 2,
//   },
//   backButton: {
//     padding: 8,
//   },
//   headerTitle: {
//     fontSize: 18,
//     fontWeight: "600",
//     color: "#fff",
//   },
//   contentContainer: {
//     flex: 1,
//     display: 'flex',
//     flexDirection: 'column',
//   },
//   inputsContainer: {
//     paddingHorizontal: 16,
//     paddingVertical: 8,
//   },
//   scrollContent: {
//     paddingVertical: 4,
//   },
//   map: { 
//     flex: 1,
//     marginTop: 0,
//   },
//   locationsContainer: {
//     marginVertical: 4,
//   },
//   locationInputWrapper: {
//     position: 'relative',
//     zIndex: 10,
//   },
//   locationCard: {
//     backgroundColor: "#fff",
//     borderRadius: 8,
//     padding: 12,
//     flexDirection: "row",
//     alignItems: "center",
//     elevation: 2,
//   },
//   errorCard: {
//     borderColor: "#f44336",
//     borderWidth: 1,
//   },
//   iconContainer: {
//     width: 36,
//     height: 36,
//     borderRadius: 18,
//     justifyContent: "center",
//     alignItems: "center",
//     marginRight: 12,
//   },
//   pickupIconContainer: {
//     backgroundColor: "#4caf50",
//   },
//   dropoffIconContainer: {
//     backgroundColor: "#f44336",
//   },
//   inputContainer: {
//     flex: 1,
//   },
//   inputLabel: {
//     fontSize: 12,
//     color: "#757575",
//     marginBottom: 4,
//   },
//   input: {
//     fontSize: 14,
//     color: "#333",
//     padding: 0,
//     marginTop: 2,
//   },
//   errorInput: {
//     color: "#f44336",
//   },
//   errorText: {
//     color: "#f44336",
//     fontSize: 12,
//     marginTop: 4,
//   },
//   connector: {
//     alignItems: "center",
//     marginVertical: 8,
//   },
//   dottedLine: {
//     height: 20,
//     width: 1,
//     backgroundColor: "#bdbdbd",
//   },
//   buttonContainer: {
//     padding: 16,
//     backgroundColor: "#fff",
//     borderTopColor: "#e0e0e0",
//     borderTopWidth: 1,
//   },
//   confirmButton: {
//     overflow: "hidden",
//     borderRadius: 8,
//     elevation: 2,
//   },
//   trackingActiveButton: {
//     overflow: "hidden",
//     borderRadius: 8,
//     elevation: 2,
//   },
//   gradientButton: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: "#0277bd",
//     paddingVertical: 14,
//     borderRadius: 8,
//   },
//   trackingActiveGradient: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: "#4caf50", // Green color when tracking is active
//     paddingVertical: 14,
//     borderRadius: 8,
//   },
//   buttonText: {
//     color: "#fff",
//     fontSize: 16,
//     fontWeight: "600",
//     marginRight: 8,
//   },
//   // Suggestion styles
//   suggestionsContainer: {
//     position: 'relative',
//     zIndex: 20,
//     marginTop: 4,
//     marginBottom: 4,
//   },
//   suggestionsList: {
//     backgroundColor: '#fff',
//     borderRadius: 8,
//     maxHeight: 200,
//     elevation: 4,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.2,
//     shadowRadius: 2,
//   },
//   suggestionItem: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     padding: 12,
//     borderBottomWidth: 1,
//     borderBottomColor: '#e0e0e0',
//   },
//   suggestionIcon: {
//     marginRight: 8,
//   },
//   suggestionText: {
//     flex: 1,
//     fontSize: 14,
//     color: '#333',
//   },
//   // Map marker styles
//   currentLocationMarker: {
//     backgroundColor: "#fff",
//     borderRadius: 50,
//     padding: 6,
//     borderWidth: 2,
//     borderColor: "#0277bd",
//   },
//   fromLocationMarker: {
//     backgroundColor: "#4caf50",
//     borderRadius: 50,
//     padding: 6,
//   },
//   toLocationMarker: {
//     backgroundColor: "#f44336",
//     borderRadius: 50,
//     padding: 6,
//   },
//   // Debug status container
//   statusContainer: {
//     position: 'absolute',
//     top: 10,
//     right: 10,
//     backgroundColor: 'rgba(255, 255, 255, 0.8)',
//     borderRadius: 16,
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//   },
//   statusIndicator: {
//     width: 10,
//     height: 10,
//     borderRadius: 5,
//     marginRight: 6,
//   },
//   connectedIndicator: {
//     backgroundColor: '#4CAF50',
//   },
//   disconnectedIndicator: {
//     backgroundColor: '#F44336',
//   },
//   statusText: {
//     fontSize: 12,
//     fontWeight: '500',
//     color: '#333',
//   },
// });

// export default LocationScreen;