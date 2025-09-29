import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  SafeAreaView,
  StatusBar,
  Dimensions,
  PermissionsAndroid,
  Image,
  ActivityIndicator,
  Platform
} from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { launchCamera, launchImageLibrary, ImageLibraryOptions } from "react-native-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import LinearGradient from "react-native-linear-gradient";

const { width } = Dimensions.get('window');

interface ServicingData {
  _id: string;
  cab: { cabNumber: string };
  serviceDate: string;
}

interface VehicleServiceScreenProps {
  navigation: any;
}

const VehicleServiceScreen: React.FC<VehicleServiceScreenProps> = ({ navigation }) => {
  const [serviceId, setServiceId] = useState("");
  const [servicing, setServicing] = useState<ServicingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [servicingCost, setServicingCost] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [errors, setErrors] = useState({
    image: "",
    servicingCost: ""
  });
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const initializeData = async () => {
      try {
        const token = await AsyncStorage.getItem("userToken");

        if (token) {
          setUserToken(token);
          await fetchAssignmentData(token);
        }
      } catch (error) {
        console.error("Error initializing data:", error);
        Alert.alert("Error", "Failed to initialize data. Please try again.");
      }
    };

    initializeData();
  }, []);

  const fetchAssignmentData = async (token: string) => {
    try {
      setLoading(true);
      const axiosInstance = axios.create({
        baseURL: "http://192.168.1.5:5000/api",
        timeout: 5000,
        headers: { Authorization: `Bearer ${token}` }
      });

      const response = await axiosInstance.get("/servicing/my-assignments");

      console.log("servicing response:", response.data);

      if (response.data.services && response.data.services.length > 0) {
        console.log("Service found:", response.data.services[0].CabsDetail?.cabNumber);
        setServiceId(response.data.services[0].id);
        setServicing(response.data.services[0]);
      } else {
        // Clear data if no services found
        setServiceId("");
        setServicing(null);
        console.log("No services found");
      }
    } catch (error) {
      console.error("Assignment fetch error:", error);
      // Clear data on error
      setServiceId("");
      setServicing(null);
      Alert.alert("Error", "Failed to fetch service assignment data");
    } finally {
      setLoading(false);
    }
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: "Camera Permission",
          message: "This app needs camera access to take photos.",
          buttonPositive: "OK",
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert("Permission Denied", "You need to allow camera access to take pictures.");
      return;
    }

    const options: ImageLibraryOptions = {
      mediaType: "photo",
      maxWidth: 600,
      maxHeight: 600,
      quality: 0.5,
      includeBase64: false,
      cameraType: 'back'
    };

    launchCamera(options, (response) => {
      if (response.didCancel) {
        return;
      } else if (response.errorCode) {
        console.error("Camera error:", response.errorCode, response.errorMessage);
        Alert.alert("Error", "Failed to capture image. Please try again.");
      } else if (response.assets && response.assets.length > 0) {
        setUploadedImage(response.assets[0].uri || null);
        setErrors(prev => ({ ...prev, image: "" }));
      }
    });
  };

  const openGallery = async () => {
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      maxWidth: 600,
      maxHeight: 600,
      quality: 0.5,
      includeBase64: false
    };

    try {
      const result = await launchImageLibrary(options);
      if (result.didCancel) {
        return;
      } else if (result.errorCode) {
        console.error("Gallery error:", result.errorCode);
        Alert.alert("Error", "Failed to select image from gallery. Please try again.");
      } else if (result.assets && result.assets.length > 0) {
        setUploadedImage(result.assets[0].uri || null);
        setErrors(prev => ({ ...prev, image: "" }));
      }
    } catch (error) {
      console.error("Gallery error:", error);
      Alert.alert("Error", "Failed to select image from gallery. Please try again.");
    }
  };

  const selectImage = () => {
    Alert.alert(
      "Upload Receipt",
      "Choose an option",
      [
        { text: "Take Photo", onPress: openCamera },
        // { text: "Choose from Gallery", onPress: openGallery },
        { text: "Cancel", style: "cancel" }
      ],
      { cancelable: true }
    );
  };

  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors = { image: "", servicingCost: "" };

    if (!servicingCost || servicingCost.trim() === '') {
      newErrors.servicingCost = 'Please enter the total amount';
      isValid = false;
    } else if (isNaN(Number(servicingCost)) || Number(servicingCost) <= 0) {
      newErrors.servicingCost = 'Please enter a valid amount';
      isValid = false;
    }

    if (!uploadedImage) {
      newErrors.image = 'Please upload a receipt image';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fill all required fields correctly");
      return;
    }

    if (!serviceId) {
      Alert.alert("Error", "No service assignment found");
      return;
    }

    setLoading(true);
    try {
      // Create FormData for multipart/form-data submission
      const formData = new FormData();
      
      // Add servicingAmount as text field
      formData.append("servicingAmount", servicingCost);
      
      // Add image file if available
      if (uploadedImage) {
        const imageData = {
          uri: uploadedImage,
          type: "image/jpeg", // or detect mime type from file extension
          name: `receipt_${Date.now()}.jpg`,
        };
        formData.append("receiptImage", imageData as any);
      }

      // Log FormData contents for debugging
      console.log("FormData being sent:");
      console.log("- servicingAmount:", servicingCost);
      console.log("- receiptImage:", uploadedImage ? "Image attached" : "No image");

      const token = userToken || await AsyncStorage.getItem("userToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      // Create axios instance with proper multipart headers
      const axiosInstance = axios.create({
        baseURL: "http://192.168.1.5:5000/api",
        timeout: 15000,
        headers: {
          "Content-Type": "multipart/form-data",
          "Authorization": `Bearer ${token}`
        }
      });

      console.log(`Submitting to: /servicing/update/${serviceId}`);

      const response = await axiosInstance.put(`/servicing/update/${serviceId}`, formData);

      console.log("Response status:", response.status);
      console.log("Response data:", response.data);

      if (response.status === 200 || response.status === 201) {
        Alert.alert("Success", "Service data submitted successfully!", [
          {
            text: "OK",
            onPress: async () => {
              // Reset form fields
              setServicingCost("");
              setUploadedImage(null);
              setErrors({ image: "", servicingCost: "" });
              
              // Refresh data to check if service is removed from list
              await fetchAssignmentData(token);
              
              // Navigate back to home
              navigation.navigate("Home");
            },
          },
        ]);
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error: any) {
      console.error("Submission error:", error);
      console.error("Error response:", error.response?.data);
      
      let errorMessage = "Failed to submit service data. Please try again.";

      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorMessage = "Request timed out. Please check your internet connection and try again.";
      } else if (error.response?.status === 413) {
        errorMessage = "Image file is too large. Please try a smaller image.";
      } else if (error.response?.status === 401) {
        errorMessage = "Session expired. Please login again.";
      } else if (error.response?.status >= 500) {
        errorMessage = "Server error. Please try again later.";
      } else if (!error.response && error.message.includes('Network')) {
        errorMessage = "Network error. Please check your internet connection.";
      }

      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBackPress = () => {
    navigation.navigate("Home");
  };

  if (loading && !servicing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor="#FFA726" barStyle="light-content" />
        <View style={styles.appHeader}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Schedule Service</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFA726" />
          <Text style={styles.loadingText}>Loading service data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#FFA726" barStyle="light-content" />
      <View style={styles.appHeader}>
        <TouchableOpacity style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule Service</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {serviceId ? (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <MaterialIcons name="car-repair" size={30} color="#FFA726" />
            <View style={styles.headerText}>
              <Text style={styles.title}>{servicing?.CabsDetail?.cabNumber || "N/A"}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              <MaterialIcons name="schedule" size={18} color="#FFA726" /> Service Schedule
            </Text>

            <Text style={styles.label}>Last Service Date</Text>
            <View style={[styles.readOnlyContainer, styles.inputServiceDate]}>
              <Text style={styles.readOnlyText}>
                {servicing?.serviceDate
                  ? new Date(servicing.serviceDate).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })
                  : 'N/A'}
              </Text>
              <MaterialIcons name="lock" size={16} color="#FFA726" style={styles.lockIcon} />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              <MaterialIcons name="receipt" size={18} color="#FFA726" /> Upload Receipt
            </Text>
            <TouchableOpacity
              style={[styles.uploadContainer, errors.image && styles.inputError]}
              onPress={selectImage}
              activeOpacity={0.8}
            >
              {uploadedImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: uploadedImage }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.changeImageButton} onPress={selectImage}>
                    <MaterialIcons name="camera-alt" size={14} color="#fff" />
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
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              <MaterialIcons name="currency-rupee" size={18} color="#FFA726" /> Service Cost
            </Text>
            <Text style={styles.label}>
              Total Amount <Text style={styles.required}>*</Text>
            </Text>
            <View style={[styles.textInputContainer, errors.servicingCost && styles.inputError]}>
              <TextInput
                placeholder="Enter Amount"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
                style={styles.input}
                value={servicingCost}
                onChangeText={(text) => {
                  const numericText = text.replace(/[^0-9.]/g, "");
                  setServicingCost(numericText);
                  setErrors(prev => ({ ...prev, servicingCost: "" }));
                }}
              />
            </View>
            {errors.servicingCost && <Text style={styles.errorText}>{errors.servicingCost}</Text>}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient colors={["#FFA726", "#FF8F00"]} style={styles.submitGradient}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="check" size={16} color="#FFFFFF" style={styles.submitIcon} />
                  <Text style={styles.submitText}>Submit</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.bottomPadding} />
        </ScrollView>
      ) : (
        <View style={styles.noCabContainer}>
          <MaterialIcons name="info" size={48} color="#FFA726" />
          <Text style={styles.noCabText}>No service assignments found</Text>
          <Text style={styles.noCabSubText}>All your servicing tasks have been completed.</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF"
  },
  appHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFA726",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 2
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff"
  },
  headerRightPlaceholder: {
    width: 36,
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  bottomPadding: {
    height: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF8E1",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FFD54F",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  headerText: {
    marginLeft: 12
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFA726"
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FFD54F",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFA726",
    marginBottom: 16
  },
  label: {
    fontSize: 15,
    color: "#FFA726",
    marginBottom: 8,
    fontWeight: "600"
  },
  required: {
    color: "#f44336",
    fontWeight: "bold"
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
  inputError: {
    borderColor: "#f44336",
  },
  errorText: {
    color: "#f44336",
    fontSize: 11,
    marginTop: 4,
  },
  readOnlyContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#FFD54F",
    backgroundColor: "#FFF8E1",
  },
  readOnlyText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "500"
  },
  lockIcon: {
    opacity: 0.7
  },
  inputServiceDate: {
    backgroundColor: "#FFF8E1",
    borderColor: "#FFD54F"
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
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
  },
  imagePreviewContainer: {
    alignItems: "center",
    width: "100%",
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
    fontWeight: "600",
    marginLeft: 4,
    fontSize: 11,
  },
  noCabContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noCabText: {
    fontSize: 20,
    color: '#FFA726',
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '600',
  },
  noCabSubText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#FFA726",
    fontWeight: "500"
  }
});

export default VehicleServiceScreen;