import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  StatusBar,
} from "react-native";
import { Button } from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";
import { launchImageLibrary } from "react-native-image-picker";
import Icon from "react-native-vector-icons/MaterialIcons";
import Toast from "react-native-toast-message";
import Footer from "./footer/Footer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from 'react-native-axios';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

interface ProfileData {
  fullName: string;
  dob: string;
  email: string;
  contact: string;
  aadharNo: string;
  address: string;
  licenseNo: string;
  vehicleNo: string;
}

interface Props {
  navigation: any;
}

const EditProfile: React.FC<Props> = ({ navigation }) => {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [res, setRes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string>("");

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  const [profileData, setProfileData] = useState<ProfileData>({
    fullName: "",
    dob: "",
    email: "",
    contact: "",
    aadharNo: "",
    address: "",
    licenseNo: "",
    vehicleNo: "",
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Animation on component mount
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Image Picker Function with animation
  const handleImagePick = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    launchImageLibrary({ mediaType: "photo", quality: 0.8 }, (response) => {
      if (response.didCancel) return;
      if (response.assets && response.assets.length > 0) {
        setProfileImage(response.assets[0].uri);
      }
    });
  };

  // Input Change Handler with validation feedback
  const handleChange = (key: string, value: string) => {
    setProfileData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  // Date Picker Change Handler
  const onChangeDate = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      handleChange("dob", selectedDate.toISOString().split("T")[0]);
    }
  };

  // Enhanced Validation Function
  const validateFields = (): boolean => {
    let newErrors: { [key: string]: string } = {};

    if (profileData.fullName && profileData.fullName.trim().length < 3) {
      newErrors.fullName = "Full Name must be at least 3 characters.";
    }

    if (profileData.dob && !profileData.dob.trim()) {
      newErrors.dob = "Date of Birth is required.";
    }

    if (profileData.email && (!profileData.email.includes("@") || !profileData.email.includes("."))) {
      newErrors.email = "Enter a valid email address.";
    }

    if (profileData.contact && !/^\d{10}$/.test(profileData.contact)) {
      newErrors.contact = "Contact must be exactly 10 digits.";
    }

    if (profileData.aadharNo && !/^\d{12}$/.test(profileData.aadharNo)) {
      newErrors.aadharNo = "Aadhar No. must be exactly 12 digits.";
    }

    if (profileData.address && profileData.address.trim().length < 5) {
      newErrors.address = "Address must be at least 5 characters.";
    }

    if (profileData.licenseNo && profileData.licenseNo.trim().length < 5) {
      newErrors.licenseNo = "License No. must be at least 5 characters.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateFields()) {
      // Shake animation for error
      Animated.sequence([
        Animated.timing(slideAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start();
      return;
    }

    setIsLoading(true);

    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) throw new Error("User token not found.");

      const payload: any = {};
      
      if (profileData.fullName) payload.name = profileData.fullName;
      if (profileData.dob) payload.dob = profileData.dob;
      if (profileData.email) payload.email = profileData.email;
      if (profileData.contact) payload.phone = profileData.contact;
      if (profileData.aadharNo) payload.adharNo = profileData.aadharNo;
      if (profileData.address) payload.address = profileData.address;
      if (profileData.licenseNo) payload.licenseNo = profileData.licenseNo;
      if (profileData.vehicleNo) payload.vehicleNo = profileData.vehicleNo;

      const response = await axios.put(
        "https://api.routebudget.com/api/assignCab/profile",
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setRes(response.data);
      Alert.alert("Success", "Profile updated successfully! 🎉", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);

    } catch (error) {
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Custom Input Component
  const CustomInput: React.FC<{
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    keyboardType?: any;
    multiline?: boolean;
    maxLength?: number;
    fieldKey: string;
    icon?: string;
  }> = ({ label, value, onChangeText, placeholder, keyboardType, multiline, maxLength, fieldKey, icon }) => (
    <Animated.View style={[styles.inputContainer, { opacity: fadeAnim }]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[
        styles.inputWrapper,
        focusedField === fieldKey && styles.inputWrapperFocused,
        errors[fieldKey] && styles.inputWrapperError
      ]}>
        {icon && <MaterialIcons name={icon} size={20} color={focusedField === fieldKey ? "#FFC107" : "#888"} style={styles.inputIcon} />}
        <TextInput
          style={[styles.input, multiline && styles.textArea]}
          placeholder={placeholder}
          placeholderTextColor="#aaa"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType || "default"}
          multiline={multiline || false}
          maxLength={maxLength}
          onFocus={() => setFocusedField(fieldKey)}
          onBlur={() => setFocusedField("")}
          editable={true}
          selectTextOnFocus={true}
          autoCorrect={false}
          autoCapitalize={fieldKey === "email" ? "none" : "sentences"}
        />
      </View>
      {errors[fieldKey] ? (
        <Animated.Text style={styles.errorText}>{errors[fieldKey]}</Animated.Text>
      ) : null}
    </Animated.View>
  );

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFC107" />
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView 
          style={styles.container} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.navigate("Profile")}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#FFC107', '#FFB300']}
                style={styles.backButtonGradient}
              >
                <MaterialIcons name="arrow-back" size={24} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <View style={{ width: 48 }} />
          </Animated.View>

          {/* Profile Picture */}
          <Animated.View style={[styles.imageContainer, { 
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }]}>
            <TouchableOpacity onPress={handleImagePick} activeOpacity={0.8}>
              <View style={styles.imageWrapper}>
                <Image
                  source={{
                    uri: profileImage || "https://images.pexels.com/photos/414612/pexels-photo-414612.jpeg?cs=srgb&dl=pexels-souvenirpixels-414612.jpg&fm=jpg",
                  }}
                  style={styles.profileImage}
                />
                <LinearGradient
                  colors={['#FFC107', '#FFB300']}
                  style={styles.cameraIcon}
                >
                  <MaterialIcons name="photo-camera" size={20} color="white" />
                </LinearGradient>
              </View>
            </TouchableOpacity>
            <Text style={styles.imageHint}>Tap to change photo</Text>
          </Animated.View>

          {/* Form Card */}
          <Animated.View style={[styles.card, { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }]}>
            <Text style={styles.sectionTitle}>Personal Information</Text>

            {/* Full Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <View style={[styles.inputWrapper, { flexDirection: 'row', alignItems: 'center' }]}>
                <MaterialIcons name="person" size={20} color="#FFC107" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#aaa"
                  value={profileData.fullName}
                  onChangeText={(text) => handleChange("fullName", text)}
                />
              </View>
              {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
            </View>

            {/* Date of Birth */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Date of Birth</Text>
              <TouchableOpacity 
                onPress={() => setShowDatePicker(true)} 
                style={styles.dateInput}
                activeOpacity={0.7}
              >
                <MaterialIcons name="calendar-today" size={20} color="#FFC107" />
                <Text style={[styles.dateText, !profileData.dob && styles.placeholderText]}>
                  {profileData.dob || "Select date of birth"}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={24} color="#888" />
              </TouchableOpacity>
              {errors.dob ? <Text style={styles.errorText}>{errors.dob}</Text> : null}
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={profileData.dob ? new Date(profileData.dob) : new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onChangeDate}
                maximumDate={new Date()}
              />
            )}

            {/* Email */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address</Text>
              <View style={[styles.inputWrapper, { flexDirection: 'row', alignItems: 'center' }]}>
                <MaterialIcons name="email" size={20} color="#FFC107" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#aaa"
                  value={profileData.email}
                  onChangeText={(text) => handleChange("email", text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            {/* Contact */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Contact Number</Text>
              <View style={[styles.inputWrapper, { flexDirection: 'row', alignItems: 'center' }]}>
                <MaterialIcons name="phone" size={20} color="#FFC107" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter 10-digit mobile number"
                  placeholderTextColor="#aaa"
                  value={profileData.contact}
                  onChangeText={(text) => handleChange("contact", text)}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
              {errors.contact ? <Text style={styles.errorText}>{errors.contact}</Text> : null}
            </View>

            {/* Address */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Address</Text>
              <View style={[styles.inputWrapper, { flexDirection: 'row', alignItems: 'flex-start' }]}>
                <MaterialIcons name="location-on" size={20} color="#FFC107" style={[styles.inputIcon, { marginTop: 15 }]} />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Enter your complete address"
                  placeholderTextColor="#aaa"
                  value={profileData.address}
                  onChangeText={(text) => handleChange("address", text)}
                  multiline={true}
                  numberOfLines={3}
                />
              </View>
              {errors.address ? <Text style={styles.errorText}>{errors.address}</Text> : null}
            </View>

            {/* Aadhar Number */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Aadhar Number</Text>
              <View style={[styles.inputWrapper, { flexDirection: 'row', alignItems: 'center' }]}>
                <MaterialIcons name="credit-card" size={20} color="#FFC107" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter 12-digit Aadhar number"
                  placeholderTextColor="#aaa"
                  value={profileData.aadharNo}
                  onChangeText={(text) => handleChange("aadharNo", text)}
                  keyboardType="numeric"
                  maxLength={12}
                />
              </View>
              {errors.aadharNo ? <Text style={styles.errorText}>{errors.aadharNo}</Text> : null}
            </View>

            {/* License Number */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>License Number</Text>
              <View style={[styles.inputWrapper, { flexDirection: 'row', alignItems: 'center' }]}>
                <MaterialIcons name="drive-eta" size={20} color="#FFC107" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter driving license number"
                  placeholderTextColor="#aaa"
                  value={profileData.licenseNo}
                  onChangeText={(text) => handleChange("licenseNo", text)}
                />
              </View>
              {errors.licenseNo ? <Text style={styles.errorText}>{errors.licenseNo}</Text> : null}
            </View>
          </Animated.View>

          {/* Save Button */}
          <Animated.View style={[styles.buttonContainer, { opacity: fadeAnim }]}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={isLoading}
              activeOpacity={0.8}
              style={styles.saveButtonContainer}
            >
              <LinearGradient
                colors={isLoading ? ['#ccc', '#999'] : ['#FFC107', '#FFB300']}
                style={styles.saveButton}
              >
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.saveButtonText}>Updating...</Text>
                  </View>
                ) : (
                  <>
                    <MaterialIcons name="save" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Toast />
        </ScrollView>

        {/* Footer */}
        <LinearGradient 
          colors={['#fbfaf6ff', '#f8f4eaff']} 
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 0 }} 
          style={styles.footerContainer}
        >
          <Footer />
        </LinearGradient>
      </KeyboardAvoidingView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFDE7",
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#FFFEF7",
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  backButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    letterSpacing: 0.5,
  },
  imageContainer: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: "#FFFEF7",
    marginBottom: 20,
  },
  imageWrapper: {
    position: 'relative',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#fff",
    elevation: 8,
    shadowColor: '#FFC107',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cameraIcon: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: "white",
    elevation: 4,
  },
  imageHint: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: "#FFFEF7",
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 20,
    color: "#333",
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: "#F5F5DC",
    borderRadius: 12,
    backgroundColor: "#FFFEF7",
    paddingHorizontal: 15,
    minHeight: 52,
  },
  inputWrapperFocused: {
    borderColor: "#FFC107",
    elevation: 2,
    shadowColor: '#FFC107',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  inputWrapperError: {
    borderColor: "#dc3545",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    paddingVertical: 15,
    paddingHorizontal: 5,
  },
  textArea: {
    textAlignVertical: 'top',
    minHeight: 80,
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: "#F5F5DC",
    borderRadius: 12,
    backgroundColor: "#FFFEF7",
    paddingHorizontal: 15,
    paddingVertical: 16,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    marginLeft: 12,
  },
  placeholderText: {
    color: "#aaa",
  },
  errorText: {
    color: "#dc3545",
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '500',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  saveButtonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#FFC107',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 10,
  },
});

export default EditProfile;