"use client"

import type React from "react"
import { useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  PermissionsAndroid,
  ActivityIndicator,
  Platform,
} from "react-native"
import MaterialIcons from "react-native-vector-icons/MaterialIcons"
import { Picker } from "@react-native-picker/picker"
import { launchImageLibrary, launchCamera } from "react-native-image-picker"
import AsyncStorage from "@react-native-async-storage/async-storage"
import axios from "react-native-axios"
import Geolocation from "@react-native-community/geolocation"
import LinearGradient from "react-native-linear-gradient"

interface FuelData {
  type: string
  amount: string
  location: string
}

interface FuelPaymentScreenProps {
  onClose?: () => void
  navigation?: any
}

const FuelPaymentScreen: React.FC<FuelPaymentScreenProps> = ({ onClose, navigation }) => {
  const [fuel, setFuel] = useState<FuelData>({ type: "Cash", amount: "", location: "" })
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [cabNumber, setCabNumber] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isLocationLoading, setIsLocationLoading] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    getCab()
    autoFetchLocation()
  }, [])

  const autoFetchLocation = async () => {
    setIsLocationLoading(true)
    try {
      const hasPermission = await requestLocationPermission()
      if (!hasPermission) {
        setIsLocationLoading(false)
        return
      }

      const position = await getLocationWithTimeout()
      const { latitude, longitude } = position.coords
      const address = await getAddressFromCoords(latitude, longitude)
      
      setFuel((prev) => ({ ...prev, location: address }))
      setCurrentLocation({ latitude, longitude, address })
      setErrors((prev) => ({ ...prev, location: "" }))
    } catch (error) {
      console.log("Auto-location failed:", error)
    } finally {
      setIsLocationLoading(false)
    }
  }

  const getLocationWithTimeout = () => {
    return new Promise<any>((resolve, reject) => {
      Geolocation.getCurrentPosition(
        resolve,
        (error) => {
          Geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 10000,
          })
        },
        {
          enableHighAccuracy: false,
          timeout: 1500,
          maximumAge: 30000,
        },
      )
    })
  }

  const getAddressFromCoords = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=AIzaSyAKjmBSUJ3XR8uD10vG2ptzqLJAZnOlzqI`,
        { signal: controller.signal },
      )

      clearTimeout(timeoutId)
      const data = await response.json()

      if (data.results && data.results.length > 0) {
        return data.results[0].formatted_address
      } else {
        throw new Error("No address found")
      }
    } catch (error) {
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
    }
  }

  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ])

        return (
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED ||
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
        )
      }
      return true
    } catch (err) {
      console.warn(err)
      return false
    }
  }

  const getCurrentLocation = async () => {
    const hasPermission = await requestLocationPermission()
    if (!hasPermission) {
      Alert.alert("Permission Denied", "Location permission is required to get current location.")
      return
    }

    setIsLocationLoading(true)

    try {
      const position = await getLocationWithTimeout()
      const { latitude, longitude } = position.coords
      const address = await getAddressFromCoords(latitude, longitude)

      setFuel((prev) => ({ ...prev, location: address }))
      setCurrentLocation({ latitude, longitude, address })
      setErrors((prev) => ({ ...prev, location: "" }))
    } catch (error) {
      console.error("Manual location error:", error)
      Alert.alert("Location Error", "Unable to get location. Please enter manually or try again.")
    } finally {
      setIsLocationLoading(false)
    }
  }

  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS === "android") {
      try {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
          title: "Camera Permission",
          message: "This app needs camera access to take photos.",
          buttonPositive: "OK",
        })
        return granted === PermissionsAndroid.RESULTS.GRANTED
      } catch (err) {
        console.warn(err)
        return false
      }
    }
    return true
  }

  const openCamera = async () => {
    const hasPermission = await requestCameraPermission()
    if (!hasPermission) {
      Alert.alert("Permission Denied", "You need to allow camera access to take pictures.")
      return
    }

    const options = {
      mediaType: "photo" as const,
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.7,
      includeBase64: false,
    }

    launchCamera(options, (response) => {
      if (response.didCancel) {
        return
      } else if (response.errorCode) {
        console.error("Camera error:", response.errorCode)
      } else if (response.assets && response.assets.length > 0) {
        setUploadedImage(response.assets[0].uri || null)
        setErrors({ ...errors, image: "" })
      }
    })
  }

  const getCab = async () => {
    try {
      setIsLoading(true)
      const token = await AsyncStorage.getItem("userToken")
      if (!token) {
        return
      }

      const response = await axios.get("http://192.168.1.5:5000/api/assignCab/driver", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.data && response.data.length > 0 && response.data[0].CabsDetail?.cabNumber) {
        setCabNumber(response.data[0].CabsDetail.cabNumber)
      }
    } catch (error) {
      console.error("Cab fetch error:", error)
      Alert.alert("Warning", "Could not fetch cab data. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const validateInputs = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!uploadedImage) {
      newErrors.image = "Please upload a receipt image"
    }

    if (!fuel.type) {
      newErrors.type = "Please select payment type"
    }

    if (!fuel.amount) {
      newErrors.amount = "Please enter amount"
    } else if (isNaN(Number.parseFloat(fuel.amount))) {
      newErrors.amount = "Amount must be a number"
    } else if (Number.parseFloat(fuel.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0"
    }

    if (!fuel.location) {
      newErrors.location = "Please enter location"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFuelPayment = async () => {
    if (!validateInputs()) {
      Alert.alert("Validation Error", "Please fill all required fields correctly")
      return
    }

    if (!cabNumber) {
      Alert.alert("Error", "No cab assigned to you.")
      return
    }

    setIsSubmitting(true)

    try {
      const token = await AsyncStorage.getItem("userToken")
      if (!token) {
        throw new Error("Authentication token not found")
      }

      const formData = new FormData()
      formData.append("fuelAmount", fuel.amount.toString())
      formData.append("fuelType", fuel.type)

      const locationData = {
        fuelLocation: fuel.location.trim(),
        coordinates: currentLocation
          ? {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }
          : null,
        timestamp: new Date().toISOString(),
      }
      formData.append("location", JSON.stringify(locationData))

      if (uploadedImage) {
        const imageData = {
          uri: uploadedImage,
          type: "image/jpeg",
          name: `fuel_receipt_${Date.now()}.jpg`,
        }
        formData.append("receiptImage", imageData as any)
      }

      const response = await axios.patch("http://192.168.1.5:5000/api/assigncab/update-trip", formData, {
        timeout: 30000,
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.status === 200 || response.status === 201) {
        Alert.alert("Success", "Fuel payment submitted successfully!", [
          {
            text: "OK",
            onPress: () => {
              setFuel({ type: "Cash", amount: "", location: "" })
              setUploadedImage(null)
              setCurrentLocation(null)
              setErrors({})

              if (onClose) {
                onClose()
              } else if (navigation) {
                navigation.navigate("Home")
              }
            },
          },
        ])
      }
    } catch (error: any) {
      console.error("Submission error:", error)
      let errorMessage = "Failed to submit fuel payment. Please try again."

      if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        errorMessage = "Upload timed out. Please check your internet connection and try again."
      } else if (error.response?.status === 413) {
        errorMessage = "Image file is too large. Please try taking a new photo."
      } else if (error.response?.status === 401) {
        errorMessage = "Session expired. Please login again."
      }

      Alert.alert("Upload Error", errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectImage = () => {
    Alert.alert(
      "Upload Receipt",
      "Choose an option",
      [
        { text: "Take Photo", onPress: openCamera },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true },
    )
  }

  if (isLoading && !cabNumber) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFA726" />
        <Text style={styles.loadingText}>Loading cab data...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.contentSection}>
        {/* Image Upload */}
        <TouchableOpacity
          style={[styles.uploadContainer, errors.image && styles.inputError]}
          onPress={selectImage}
          activeOpacity={0.8}
        >
          {uploadedImage ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: uploadedImage }} style={styles.previewImage} />
              <TouchableOpacity style={styles.changeImageButton} onPress={selectImage} activeOpacity={0.7}>
                <MaterialIcons name="camera-alt" size={14} color="#FFFFFF" />
                <Text style={styles.changeImageText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.uploadCircle}>
                <MaterialIcons name="camera-alt" size={24} color="#ffffff" />
              </View>
              <Text style={styles.uploadText}>Upload Receipt</Text>
            </>
          )}
        </TouchableOpacity>
        {errors.image && <Text style={styles.errorText}>{errors.image}</Text>}

        {/* Payment Method */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            <MaterialIcons name="payment" size={16} color="#FFA726" /> Payment Method
          </Text>
          <View style={[styles.pickerContainer, errors.type && styles.inputError]}>
            <Picker
              selectedValue={fuel.type}
              style={styles.picker}
              onValueChange={(itemValue) => {
                setFuel({ ...fuel, type: itemValue })
                setErrors({ ...errors, type: "" })
              }}
            >
              <Picker.Item label="Cash Payment" value="Cash" />
              <Picker.Item label="Card Payment" value="Card" />
            </Picker>
          </View>
          {errors.type && <Text style={styles.errorText}>{errors.type}</Text>}
        </View>

        {/* Amount */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            <MaterialIcons name="currency-rupee" size={16} color="#FFA726" /> Amount
          </Text>
          <View style={[styles.textInputContainer, errors.amount && styles.inputError]}>
            <TextInput
              style={styles.input}
              value={fuel.amount}
              onChangeText={(text) => {
                const numericText = text.replace(/[^0-9.]/g, "")
                setFuel({ ...fuel, amount: numericText })
                setErrors({ ...errors, amount: "" })
              }}
              keyboardType="decimal-pad"
              placeholder="Enter amount"
              placeholderTextColor="#999"
            />
          </View>
          {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
        </View>

        {/* Location */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            <MaterialIcons name="location-on" size={16} color="#FFA726" /> Location
          </Text>
          <View style={[styles.locationInputContainer, errors.location && styles.inputError]}>
            <TextInput
              style={styles.locationInput}
              value={fuel.location}
              onChangeText={(text) => {
                setFuel({ ...fuel, location: text })
                setErrors({ ...errors, location: "" })
              }}
              placeholder={isLocationLoading ? "Getting location..." : "Enter location"}
              placeholderTextColor="#999"
              multiline={true}
              numberOfLines={2}
            />
            <TouchableOpacity
              style={[styles.locationButton, isLocationLoading && styles.locationButtonLoading]}
              onPress={getCurrentLocation}
              disabled={isLocationLoading}
            >
              {isLocationLoading ? (
                <ActivityIndicator size="small" color="#FFA726" />
              ) : (
                <MaterialIcons name="my-location" size={18} color="#FFA726" />
              )}
            </TouchableOpacity>
          </View>
          {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleFuelPayment}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          <LinearGradient colors={["#FFA726", "#FF8F00"]} style={styles.submitGradient}>
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="check" size={16} color="#FFFFFF" style={styles.submitIcon} />
                <Text style={styles.submitText}>Submit Payment</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  contentSection: {
    flex: 1,
    padding: 6,
    paddingTop: 10,
    justifyContent: 'space-between',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    marginTop: 8,
    color: "#FFA726",
    fontSize: 14,
    fontWeight: "500",
  },
  uploadContainer: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#FFD54F",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    backgroundColor: "#FFF8E1",
    marginBottom: 15,
  },
  uploadCircle: {
    width: 35,
    height: 35,
    borderRadius: 25,
    backgroundColor: "#FFA726",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    elevation: 3,
  },
  uploadText: {
    fontSize: 14,
    color: "#FFA726",
    fontWeight: "600",
  },
  imagePreviewContainer: {
    alignItems: "center",
    width: "100%",
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
  },
  changeImageButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFA726",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  changeImageText: {
    color: "#FFFFFF",
    marginLeft: 4,
    fontSize: 11,
    fontWeight: "600",
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFA726",
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1.5,
    borderColor: "#FFD54F",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    elevation: 1,
  },
  picker: {
    height: 53,
    color: "#333",
  },
  textInputContainer: {
    borderWidth: 1.5,
    borderColor: "#FFD54F",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 15,
    elevation: 1,
  },
  input: {
    height: 40,
    fontSize: 15,
    color: "#333",
  },
  locationInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFD54F",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    elevation: 1,
    minHeight: 40,
  },
  locationInput: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 15,
    color: "#333",
    minHeight: 24,
  },
  locationButton: {
    padding: 10,
    borderLeftWidth: 1,
    borderLeftColor: "#FFD54F",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  locationButtonLoading: {
    backgroundColor: "#FFF8E1",
  },
  submitButton: {
    height: 50,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  submitIcon: {
    marginRight: 6,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    color: "#f44336",
    fontSize: 11,
    marginTop: 4,
  },
  inputError: {
    borderColor: "#f44336",
  },
})

export default FuelPaymentScreen