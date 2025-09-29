// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   StyleSheet,
//   Image,
//   ScrollView,
//   Alert,
//   PermissionsAndroid,
//   Platform,
//   ActivityIndicator,
//   SafeAreaView,
//   StatusBar,
//   Dimensions,
//   Animated
// } from "react-native";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import FontAwesome from "react-native-vector-icons/FontAwesome";
// import { launchImageLibrary, launchCamera } from "react-native-image-picker";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import axios from "react-native-axios";

// const { width, height } = Dimensions.get('window');

// interface TyrePunctureData {
//   repairAmount: string;
// }

// interface TyrePunctureScreenProps {
//   navigation: any;
// }

// const TyrePunctureScreen: React.FC<TyrePunctureScreenProps> = ({ navigation }) => {
//   const [tyrePuncture, setTyrePuncture] = useState<TyrePunctureData>({ repairAmount: "" });
//   const [uploadedImage, setUploadedImage] = useState<string | null>(null);
//   const [cabNumber, setCabNumber] = useState('');
//   const [initialLoading, setInitialLoading] = useState(true);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [errors, setErrors] = useState({
//     image: '',
//     repairAmount: ''
//   });
//   const [userToken, setUserToken] = useState<string | null>(null);

//   useEffect(() => {
//     const getTokenAndCab = async () => {
//       try {
//         const token = await AsyncStorage.getItem("userToken");
//         if (token) {
//           setUserToken(token);
//           await fetchCabDetails(token);
//         }
//       } catch (error) {
//         console.error("Token fetch error:", error);
//       } finally {
//         // Always set loading to false after attempting to fetch data
//         setInitialLoading(false);
//       }
//     };
    
//     getTokenAndCab();
//   }, []);

//   const fetchCabDetails = async (token: string) => {
//     try {
//       const axiosInstance = axios.create({
//         baseURL: "http://192.168.1.47:5000/api",
//         timeout: 5000,
//         headers: { Authorization: `Bearer ${token}` }
//       });
      
//       const response = await axiosInstance.get("/assignCab/driver");
      
//       if (response.data && response.data.length > 0 && response.data[0].CabsDetail.cabNumber) {
//         setCabNumber(response.data[0].CabsDetail.cabNumber);
//       }
//     } catch (error) {
//       console.error("Cab fetch error:", error);
//       // Don't show alert immediately, just log the error
//       console.log("Could not fetch cab data");
//     }
//   };

//   const validateForm = (): boolean => {
//     let valid = true;
//     const newErrors = { image: '', repairAmount: '' };

//     if (!uploadedImage) {
//       newErrors.image = 'Please upload an image of the punctured tyre';
//       valid = false;
//     }

//     if (!tyrePuncture.repairAmount) {
//       newErrors.repairAmount = 'Please enter the repair amount';
//       valid = false;
//     } else if (isNaN(Number(tyrePuncture.repairAmount)) || parseFloat(tyrePuncture.repairAmount) <= 0) {
//       newErrors.repairAmount = 'Please enter a valid amount';
//       valid = false;
//     }

//     setErrors(newErrors);
//     return valid;
//   };

//   const requestCameraPermission = async (): Promise<boolean> => {
//     if (Platform.OS !== 'android') return true;
    
//     try {
//       const granted = await PermissionsAndroid.request(
//         PermissionsAndroid.PERMISSIONS.CAMERA,
//         {
//           title: "Camera Permission",
//           message: "This app needs camera access to take photos.",
//           buttonPositive: "OK",
//         }
//       );
//       return granted === PermissionsAndroid.RESULTS.GRANTED;
//     } catch (err) {
//       console.warn(err);
//       return false;
//     }
//   };

//   const openCamera = async () => {
//     const hasPermission = await requestCameraPermission();
//     if (!hasPermission) {
//       Alert.alert("Permission Denied", "You need to allow camera access to take pictures.");
//       return;
//     }
  
//     const options = { 
//       mediaType: "photo" as const, 
//       maxWidth: 800,
//       maxHeight: 800,
//       quality: 0.7,
//       includeBase64: false,
//       cameraType: 'back' as const
//     };
    
//     launchCamera(options, (response) => {
//       if (response.didCancel) {
//         return;
//       } else if (response.errorCode) {
//         console.error("Camera error:", response.errorCode, response.errorMessage);
//       } else if (response.assets && response.assets.length > 0) {
//         setUploadedImage(response.assets[0].uri || null);
//         setErrors(prev => ({...prev, image: ''}));
//       }
//     });
//   };
  
//   const openGallery = async () => {
//     const options = { 
//       mediaType: 'photo' as const, 
//       maxWidth: 800,
//       maxHeight: 800,
//       quality: 0.7,
//       includeBase64: false
//     };
    
//     try {
//       const result = await launchImageLibrary(options);
//       if (result.assets && result.assets[0]) {
//         setUploadedImage(result.assets[0].uri || null);
//         setErrors(prev => ({...prev, image: ''}));
//       }
//     } catch (error) {
//       console.error("Gallery error:", error);
//     }
//   };

//   const handleAmountChange = (amount: string) => {
//     setTyrePuncture({ ...tyrePuncture, repairAmount: amount });
//     if (amount) {
//       setErrors(prev => ({ ...prev, repairAmount: '' }));
//     }
//   };

//   const handleTyrePuncture = async () => {
//     if (!validateForm()) {
//       Alert.alert("Validation Error", "Please fill all required fields correctly");
//       return;
//     }

//     if (!cabNumber) {
//       Alert.alert("Error", "No cab assigned to you");
//       return;
//     }

//     setIsSubmitting(true);
    
//     try {
//       let imageToUpload = null;
//       if (uploadedImage) {
//         imageToUpload = {
//           uri: uploadedImage,
//           type: "image/jpeg",
//           name: `puncture_${Date.now()}.jpg`,
//         };
//       }

//       const formData = new FormData();
//       formData.append("cabNumber", cabNumber);
//       formData.append("tyrePuncture", JSON.stringify(tyrePuncture));
//       if (imageToUpload) {
//         formData.append("punctureImage", imageToUpload as any);
//       }

//       const token = userToken || await AsyncStorage.getItem("userToken");
      
//       const axiosInstance = axios.create({
//         baseURL: "http://192.168.1.47:5000/api",
//         timeout: 15000,
//         headers: {
//           "Content-Type": "multipart/form-data",
//           "Authorization": `Bearer ${token}`
//         }
//       });


//       setTimeout(()=>{
//          Alert.alert("Success", "Tyre puncture report submitted successfully!", [
//         {
//           text: "OK",
//           onPress: () => { setErrors({ image: '', repairAmount: '' });
//             navigation.navigate("Home");
//           },
//         },
//       ]);
//       setIsSubmitting(false);
        
//       },1000)
      
//       const res = await axiosInstance.patch(
//         "/assigncab/update-trip",
//         formData
//       );
      
     
//     setUploadedImage(null);
//     setTyrePuncture({ repairAmount: "" });
           
      
//     } catch (error) {
//       console.error("Submission error:", error);
//       Alert.alert("Error", "Failed to submit report. Please try again.");
//     } finally {
//       // setIsSubmitting(false);
//     }
//   };

//   const selectImage = () => {
//     Alert.alert(
//       "Upload Tyre Image",
//       "Choose an option",
//       [
//         { text: "Take Photo", onPress: openCamera },
//         // { text: "Choose from Gallery", onPress: openGallery },
//         { text: "Cancel", style: "cancel" }
//       ],
//       { cancelable: true }
//     );
//   };

//   // Show loading only during initial data fetch
//   if (initialLoading) {
//     return (
//       <SafeAreaView style={styles.mainContainer}>
//         <StatusBar backgroundColor="#1e40af" barStyle="light-content" />
//         <View style={styles.header}>
//           <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
//             <MaterialIcons name="arrow-back" size={24} color="#fff" />
//           </TouchableOpacity>
//           <Text style={styles.headerTitle}>Tyre Puncture Report</Text>
//           <TouchableOpacity style={styles.headerAction}>
//             <MaterialIcons name="help-outline" size={24} color="#fff" />
//           </TouchableOpacity>
//         </View>
//         <View style={styles.loadingContainer}>
//           <ActivityIndicator size="large" color="#1e40af" />
//           <Text style={styles.loadingText}>Loading vehicle data...</Text>
//         </View>
//       </SafeAreaView>
//     );
//   }

//   return (
//     <SafeAreaView style={styles.mainContainer}>
//       <StatusBar backgroundColor="#1e40af" barStyle="light-content" />
      
//       {/* Header */}
//       <View style={styles.header}>
//         <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
//           <MaterialIcons name="arrow-back" size={24} color="#fff" />
//         </TouchableOpacity>
//         <Text style={styles.headerTitle}>Tyre Puncture Report</Text>
//         <TouchableOpacity style={styles.headerAction}>
//           <MaterialIcons name="help-outline" size={24} color="#fff" />
//         </TouchableOpacity>
//       </View>

//       {/* Main Content - Remove animations that might cause rendering issues */}
//       <ScrollView 
//         style={styles.scrollView}
//         showsVerticalScrollIndicator={false}
//         contentContainerStyle={styles.scrollContent}
//       >
//         {/* Vehicle Info Card */}
//         {cabNumber ? (
//           <View style={styles.vehicleCard}>
//             <View style={styles.vehicleIconContainer}>
//               <MaterialIcons name="build" size={28} color="#1e40af" />
//             </View>
//             <View style={styles.vehicleInfo}>
//               <Text style={styles.vehicleNumber}>{cabNumber}</Text>
//               <Text style={styles.vehicleSubtitle}>Tyre Puncture Report</Text>
//             </View>
//             <View style={styles.statusBadge}>
//               <Text style={styles.statusText}>Repair</Text>
//             </View>
//           </View>
//         ) : (
//           <View style={styles.noCabCard}>
//             <MaterialIcons name="warning" size={24} color="#f59e0b" />
//             <Text style={styles.noCabText}>No vehicle assigned</Text>
//           </View>
//         )}

//         {/* Info Alert Card */}
//         <View style={styles.infoCard}>
//           <View style={styles.infoIconContainer}>
//             <MaterialIcons name="info" size={20} color="#1e40af" />
//           </View>
//           <View style={styles.infoContent}>
//             <Text style={styles.infoTitle}>Important Instructions</Text>
//             <Text style={styles.infoText}>
//               Please upload clear images of the punctured tyre and provide the accurate repair cost estimate for processing.
//             </Text>
//           </View>
//         </View>

//         {/* Image Upload Card */}
//         <View style={styles.card}>
//           <View style={styles.cardHeader}>
//             <MaterialIcons name="camera-alt" size={20} color="#1e40af" />
//             <Text style={styles.cardTitle}>Upload Tyre Images</Text>
//           </View>
          
//           <TouchableOpacity 
//             style={[styles.uploadContainer, errors.image && styles.uploadError]} 
//             onPress={selectImage}
//             activeOpacity={0.7}
//           >
//             {uploadedImage ? (
//               <View style={styles.imagePreviewContainer}>
//                 <Image source={{ uri: uploadedImage }} style={styles.previewImage} />
//                 <View style={styles.imageOverlay}>
//                   <TouchableOpacity style={styles.changeImageButton} onPress={selectImage}>
//                     <MaterialIcons name="edit" size={16} color="#fff" />
//                     <Text style={styles.changeImageText}>Change</Text>
//                   </TouchableOpacity>
//                 </View>
//               </View>
//             ) : (
//               <View style={styles.uploadContent}>
//                 <View style={styles.uploadIconContainer}>
//                   <MaterialIcons name="cloud-upload" size={32} color="#1e40af" />
//                 </View>
//                 <Text style={styles.uploadTitle}>Upload Tyre Image</Text>
//                 <Text style={styles.uploadSubtitle}>Tap to take photo or choose from gallery</Text>
//               </View>
//             )}
//           </TouchableOpacity>
//           {errors.image ? (
//             <View style={styles.errorContainer}>
//               <MaterialIcons name="error-outline" size={16} color="#ef4444" />
//               <Text style={styles.errorText}>{errors.image}</Text>
//             </View>
//           ) : null}
//         </View>

//         {/* Repair Cost Card */}
//         <View style={styles.card}>
//           <View style={styles.cardHeader}>
//             <MaterialIcons name="attach-money" size={20} color="#1e40af" />
//             <Text style={styles.cardTitle}>Repair Cost</Text>
//           </View>
          
//           <View style={styles.inputContainer}>
//             <Text style={styles.inputLabel}>
//               Repair Amount <Text style={styles.required}>*</Text>
//             </Text>
//             <View style={[styles.inputWrapper, errors.repairAmount && styles.inputError]}>
//               <View style={styles.currencyIconContainer}>
//                 <MaterialIcons name="currency-rupee" size={20} color="#1e40af" />
//               </View>
//               <TextInput
//                 style={styles.textInput}
//                 placeholder="Enter repair amount"
//                 placeholderTextColor="#9ca3af"
//                 keyboardType="numeric"
//                 value={tyrePuncture.repairAmount}
//                 onChangeText={handleAmountChange}
//               />
//             </View>
//             {errors.repairAmount ? (
//               <View style={styles.errorContainer}>
//                 <MaterialIcons name="error-outline" size={16} color="#ef4444" />
//                 <Text style={styles.errorText}>{errors.repairAmount}</Text>
//               </View>
//             ) : null}
//           </View>

//           {/* Cost Breakdown Info */}
//           <View style={styles.costInfoContainer}>
//             <MaterialIcons name="receipt" size={16} color="#6b7280" />
//             <Text style={styles.costInfoText}>
//               Include all repair costs: labour, materials, and service charges
//             </Text>
//           </View>
//         </View>

//         {/* Emergency Contact Card */}
//         {/* <View style={styles.emergencyCard}>
//           <View style={styles.emergencyHeader}>
//             <MaterialIcons name="phone" size={20} color="#dc2626" />
//             <Text style={styles.emergencyTitle}>Emergency Contact</Text>
//           </View>
//           <Text style={styles.emergencyText}>
//             For immediate assistance, call: <Text style={styles.emergencyNumber}>+91 9876543210</Text>
//           </Text>
//         </View> */}

//         {/* Add some bottom padding for the fixed button */}
//         <View style={styles.bottomPadding} />
//       </ScrollView>

//       {/* Submit Button */}
//       <View style={styles.footer}>
//         <TouchableOpacity 
//           style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
//           onPress={handleTyrePuncture}
//           disabled={isSubmitting}
//           activeOpacity={0.8}
//         >
//           {isSubmitting ? (
//             <View style={styles.loadingButtonContent}>
//               <ActivityIndicator size="small" color="#FFFFFF" />
//               <Text style={styles.submitButtonText}>Submitting...</Text>
//             </View>
//           ) : (
//             <View style={styles.buttonContent}>
//               <MaterialIcons name="send" size={20} color="#fff" />
//               <Text style={styles.submitButtonText}>Submit Report</Text>
//             </View>
//           )}
//         </TouchableOpacity>
//       </View>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   mainContainer: {
//     flex: 1,
//     backgroundColor: "#f8fafc"
//   },
//   scrollView: {
//     flex: 1,
//   },
//   scrollContent: {
//     padding: 16,
//   },
//   bottomPadding: {
//     height: 100, // Space for fixed button
//   },
//   loadingContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 32,
//   },
//   loadingText: {
//     marginTop: 16,
//     fontSize: 16,
//     color: "#1e40af",
//     fontWeight: "500"
//   },
//   header: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     backgroundColor: "#1e40af",
//     paddingVertical: 16,
//     paddingHorizontal: 16,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.1,
//     shadowRadius: 4,
//     elevation: 4
//   },
//   backButton: {
//     padding: 8,
//     borderRadius: 8,
//   },
//   headerTitle: {
//     fontSize: 18,
//     fontWeight: "700",
//     color: "#fff"
//   },
//   headerAction: {
//     padding: 8,
//     borderRadius: 8,
//   },
//   vehicleCard: {
//     flexDirection: "row",
//     alignItems: "center",
//     backgroundColor: "#ffffff",
//     padding: 20,
//     borderRadius: 16,
//     marginBottom: 16,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 8,
//     elevation: 3,
//     borderLeftWidth: 4,
//     borderLeftColor: "#1e40af"
//   },
//   noCabCard: {
//     flexDirection: "row",
//     alignItems: "center",
//     backgroundColor: "#fef3c7",
//     padding: 16,
//     borderRadius: 12,
//     marginBottom: 16,
//     borderLeftWidth: 4,
//     borderLeftColor: "#f59e0b"
//   },
//   noCabText: {
//     fontSize: 14,
//     color: "#92400e",
//     fontWeight: "500",
//     marginLeft: 8,
//   },
//   vehicleIconContainer: {
//     width: 56,
//     height: 56,
//     borderRadius: 28,
//     backgroundColor: "#eff6ff",
//     alignItems: "center",
//     justifyContent: "center",
//     marginRight: 16,
//   },
//   vehicleInfo: {
//     flex: 1,
//   },
//   vehicleNumber: {
//     fontSize: 20,
//     fontWeight: "700",
//     color: "#1f2937",
//     marginBottom: 4,
//   },
//   vehicleSubtitle: {
//     fontSize: 14,
//     color: "#6b7280",
//     fontWeight: "500"
//   },
//   statusBadge: {
//     backgroundColor: "#fef3c7",
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     borderRadius: 20,
//   },
//   statusText: {
//     fontSize: 12,
//     fontWeight: "600",
//     color: "#d97706",
//   },
//   infoCard: {
//     flexDirection: "row",
//     backgroundColor: "#eff6ff",
//     borderRadius: 12,
//     padding: 16,
//     marginBottom: 16,
//     borderLeftWidth: 4,
//     borderLeftColor: "#1e40af"
//   },
//   infoIconContainer: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: "#dbeafe",
//     alignItems: "center",
//     justifyContent: "center",
//     marginRight: 12,
//   },
//   infoContent: {
//     flex: 1,
//   },
//   infoTitle: {
//     fontSize: 14,
//     fontWeight: "600",
//     color: "#1e40af",
//     marginBottom: 4,
//   },
//   infoText: {
//     fontSize: 13,
//     color: "#374151",
//     lineHeight: 18,
//   },
//   card: {
//     backgroundColor: "#ffffff",
//     borderRadius: 16,
//     padding: 20,
//     marginBottom: 16,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 8,
//     elevation: 3
//   },
//   cardHeader: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginBottom: 16,
//   },
//   cardTitle: {
//     fontSize: 16,
//     fontWeight: "600",
//     color: "#1f2937",
//     marginLeft: 8,
//   },
//   uploadContainer: {
//     borderWidth: 2,
//     borderStyle: "dashed",
//     borderColor: "#d1d5db",
//     borderRadius: 12,
//     padding: 24,
//     alignItems: "center",
//     backgroundColor: "#f9fafb",
//     minHeight: 120,
//   },
//   uploadError: {
//     borderColor: "#ef4444",
//     backgroundColor: "#fef2f2",
//   },
//   uploadContent: {
//     alignItems: "center",
//   },
//   uploadIconContainer: {
//     width: 64,
//     height: 64,
//     borderRadius: 32,
//     backgroundColor: "#eff6ff",
//     alignItems: "center",
//     justifyContent: "center",
//     marginBottom: 12,
//   },
//   uploadTitle: {
//     fontSize: 16,
//     fontWeight: "600",
//     color: "#1f2937",
//     marginBottom: 4,
//   },
//   uploadSubtitle: {
//     fontSize: 14,
//     color: "#6b7280",
//     textAlign: "center",
//   },
//   imagePreviewContainer: {
//     position: "relative",
//     alignItems: "center",
//   },
//   previewImage: {
//     width: width * 0.6,
//     height: width * 0.4,
//     borderRadius: 12,
//   },
//   imageOverlay: {
//     position: "absolute",
//     bottom: 8,
//     right: 8,
//   },
//   changeImageButton: {
//     flexDirection: "row",
//     alignItems: "center",
//     backgroundColor: "#1e40af",
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     borderRadius: 20,
//   },
//   changeImageText: {
//     color: "#ffffff",
//     fontSize: 12,
//     fontWeight: "600",
//     marginLeft: 4,
//   },
//   inputContainer: {
//     marginBottom: 16,
//   },
//   inputLabel: {
//     fontSize: 14,
//     fontWeight: "600",
//     color: "#374151",
//     marginBottom: 8,
//   },
//   required: {
//     color: "#ef4444",
//   },
//   inputWrapper: {
//     flexDirection: "row",
//     alignItems: "center",
//     backgroundColor: "#f9fafb",
//     borderWidth: 1,
//     borderColor: "#d1d5db",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//   },
//   inputError: {
//     borderColor: "#ef4444",
//     backgroundColor: "#fef2f2",
//   },
//   currencyIconContainer: {
//     width: 32,
//     height: 32,
//     borderRadius: 16,
//     backgroundColor: "#eff6ff",
//     alignItems: "center",
//     justifyContent: "center",
//     marginRight: 12,
//   },
//   textInput: {
//     flex: 1,
//     fontSize: 16,
//     color: "#1f2937",
//     fontWeight: "500",
//   },
//   errorContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginTop: 8,
//   },
//   errorText: {
//     fontSize: 12,
//     color: "#ef4444",
//     marginLeft: 4,
//     fontWeight: "500",
//   },
//   costInfoContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//     backgroundColor: "#f9fafb",
//     padding: 12,
//     borderRadius: 8,
//     marginTop: 8,
//   },
//   costInfoText: {
//     fontSize: 12,
//     color: "#6b7280",
//     marginLeft: 8,
//     flex: 1,
//     lineHeight: 16,
//   },
//   emergencyCard: {
//     backgroundColor: "#fef2f2",
//     borderRadius: 12,
//     padding: 16,
//     borderLeftWidth: 4,
//     borderLeftColor: "#dc2626",
//   },
//   emergencyHeader: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginBottom: 8,
//   },
//   emergencyTitle: {
//     fontSize: 14,
//     fontWeight: "600",
//     color: "#dc2626",
//     marginLeft: 8,
//   },
//   emergencyText: {
//     fontSize: 13,
//     color: "#374151",
//     lineHeight: 18,
//   },
//   emergencyNumber: {
//     fontWeight: "700",
//     color: "#dc2626",
//   },
//   footer: {
//     position: "absolute",
//     bottom: 0,
//     left: 0,
//     right: 0,
//     backgroundColor: "#ffffff",
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: -3 },
//     shadowOpacity: 0.1,
//     shadowRadius: 5,
//     elevation: 10,
//     borderTopLeftRadius: 20,
//     borderTopRightRadius: 20,
//   },
//   submitButton: {
//     backgroundColor: "#1e40af",
//     borderRadius: 12,
//     padding: 16,
//     alignItems: "center",
//     shadowColor: "#1e40af",
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.3,
//     shadowRadius: 8,
//     elevation: 4,
//   },
//   submitButtonDisabled: {
//     backgroundColor: "#9ca3af",
//   },
//   buttonContent: {
//     flexDirection: "row",
//     alignItems: "center",
//   },
//   loadingButtonContent: {
//     flexDirection: "row",
//     alignItems: "center",
//   },
//   submitButtonText: {
//     color: "#ffffff",
//     fontSize: 16,
//     fontWeight: "700",
//     marginLeft: 8,
//   },
// });

// export default TyrePunctureScreen;



import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
} from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { launchImageLibrary, launchCamera } from "react-native-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "react-native-axios";
import LinearGradient from "react-native-linear-gradient";

interface TyrePunctureData {
  repairAmount: string;
}

interface TyrePunctureScreenProps {
  onClose: () => void;
}

const TyrePunctureScreen: React.FC<TyrePunctureScreenProps> = ({ onClose }) => {
  const [tyrePuncture, setTyrePuncture] = useState<TyrePunctureData>({ repairAmount: "" });
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [cabNumber, setCabNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({
    image: '',
    repairAmount: ''
  });

  useEffect(() => {
    getCab();
  }, []);

  const getCab = async (): Promise<void> => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("userToken");

      if (token) {
        const response = await axios.get(
          "http://192.168.1.5:5000/api/assignCab/driver",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.data && response.data.length > 0) {
          setCabNumber(response.data[0].CabsDetail.cabNumber || "");
        }
      } else {
        setCabNumber("TEST-CAB-001");
      }
    } catch (error) {
      console.log("Error fetching cab data:", error);
      setCabNumber("TEST-CAB-001");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    let valid = true;
    const newErrors = { image: '', repairAmount: '' };

    if (!uploadedImage) {
      newErrors.image = 'Please upload an image';
      valid = false;
    }

    if (!tyrePuncture.repairAmount) {
      newErrors.repairAmount = 'Please enter amount';
      valid = false;
    } else if (isNaN(Number(tyrePuncture.repairAmount)) || parseFloat(tyrePuncture.repairAmount) <= 0) {
      newErrors.repairAmount = 'Enter valid amount';
      valid = false;
    }

    setErrors(newErrors);
    return valid;
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
  
    const options = { 
      mediaType: "photo" as const, 
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.7,
      includeBase64: false,
      cameraType: 'back' as const
    };
    
    launchCamera(options, (response) => {
      if (response.didCancel) {
        return;
      } else if (response.errorCode) {
        console.error("Camera error:", response.errorCode, response.errorMessage);
      } else if (response.assets && response.assets.length > 0) {
        setUploadedImage(response.assets[0].uri || null);
        setErrors(prev => ({...prev, image: ''}));
      }
    });
  };
  
  const openGallery = async () => {
    const options = { 
      mediaType: 'photo' as const, 
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.7,
      includeBase64: false
    };
    
    try {
      const result = await launchImageLibrary(options);
      if (result.assets && result.assets[0]) {
        setUploadedImage(result.assets[0].uri || null);
        setErrors(prev => ({...prev, image: ''}));
      }
    } catch (error) {
      console.error("Gallery error:", error);
    }
  };

  const formatAmount = (text: string): string => {
    const numericValue = text.replace(/[^0-9.]/g, '');
    const parts = numericValue.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    return numericValue;
  };

  const handleAmountChange = (amount: string) => {
    const formattedAmount = formatAmount(amount);
    setTyrePuncture({ ...tyrePuncture, repairAmount: formattedAmount });
    if (formattedAmount) {
      setErrors(prev => ({ ...prev, repairAmount: '' }));
    }
  };

  const handleTyrePuncture = async () => {
    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fill all required fields correctly");
      return;
    }

    if (!cabNumber) {
      Alert.alert("Error", "No cab assigned to you");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const token = await AsyncStorage.getItem("userToken");
      
      if (!token) {
        Alert.alert("Error", "Authentication token not found. Please login again.");
        setIsSubmitting(false);
        return;
      }

      const formData = new FormData();
      formData.append("tyreRepairAmount", tyrePuncture.repairAmount);
      
      if (uploadedImage) {
        formData.append("punctureImage", {
          uri: uploadedImage,
          type: "image/jpeg",
          name: `puncture_${Date.now()}.jpg`,
        } as any);
      }

      const uploadConfig = {
        timeout: 30000,
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      };

      const response = await axios.patch(
        "http://192.168.1.5:5000/api/assigncab/update-trip",
        formData,
        uploadConfig
      );

      if (response.status === 200 || response.status === 201) {
        Alert.alert("Success", "Tyre puncture report submitted successfully!", [
          {
            text: "OK",
            onPress: () => {
              setUploadedImage(null);
              setTyrePuncture({ repairAmount: "" });
              setErrors({ image: '', repairAmount: '' });
              onClose();
            },
          },
        ]);
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
      
    } catch (error: any) {
      console.error("Submission error:", error);
      
      let errorMessage = "Failed to submit report. Please try again.";
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorMessage = "Upload timed out. Please check your internet connection and try again.";
      } else if (error.response?.status === 401) {
        errorMessage = "Session expired. Please login again.";
      } else if (error.response?.status === 404) {
        errorMessage = "No active trip found. Please contact support.";
      } else if (error.response?.status >= 500) {
        errorMessage = "Server error. Please try again in a few moments.";
      } else if (!error.response && error.message.includes('Network')) {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      Alert.alert("Upload Error", errorMessage, [
        { text: "OK", style: "default" }
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectImage = () => {
    Alert.alert(
      "Upload Tyre Image",
      "Choose an option",
      [
        { text: "Take Photo", onPress: openCamera },
        // { text: "Choose from Gallery", onPress: openGallery },
        { text: "Cancel", style: "cancel" }
      ],
      { cancelable: true }
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF8F00" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.contentSection}>
        {/* Image Upload - Compact Version */}
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
              <Text style={styles.uploadText}>Take Photo</Text>
            </>
          )}
        </TouchableOpacity>
        {errors.image && <Text style={styles.errorText}>{errors.image}</Text>}

        {/* Amount Input - Compact */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            <MaterialIcons name="currency-rupee" size={16} color="#FF8F00" /> Repair Amount
          </Text>
          <View style={[styles.textInputContainer, errors.repairAmount && styles.inputError]}>
            <MaterialIcons name="currency-rupee" size={16} color="#FF8F00" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={tyrePuncture.repairAmount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              placeholder="Enter repair cost"
              placeholderTextColor="#999"
            />
          </View>
          {errors.repairAmount && (
            <Text style={styles.errorText}>
              <MaterialIcons name="error" size={12} color="#f44336" /> {errors.repairAmount}
            </Text>
          )}
        </View>

        {/* Submit Button - Compact */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleTyrePuncture}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          <LinearGradient colors={["#FFA726", "#FF8F00"]} style={styles.submitGradient}>
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="check" size={16} color="#FFFFFF" style={styles.submitIcon} />
                <Text style={styles.submitText}>Submit Report</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  contentSection: {
    flex: 1,
    padding: 7,
    paddingTop: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 8,
    color: '#FF8F00',
    fontSize: 14,
    fontWeight: '500',
  },
  uploadContainer: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#FFB74D",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    backgroundColor: "#FFF8E1",
    marginBottom: 15,
  },
  uploadCircle: {
    width: 30,
    height: 30,
    borderRadius: 20,
    backgroundColor: "#FF8F00",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    elevation: 3,
  },
  uploadText: {
    fontSize: 14,
    color: "#FF8F00",
    fontWeight: "600",
  },
  imagePreviewContainer: {
    alignItems: "center",
    width: "100%",
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 8,
  },
  changeImageButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF8F00",
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
    fontSize: 14,
    fontWeight: "600",
    color: "#FF8F00",
    marginBottom: 6,
  },
  textInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFB74D",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 42,
    fontSize: 15,
    color: "#333",
  },
  submitButton: {
    height: 44,
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 5,
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
    borderRadius: 10,
  },
  submitIcon: {
    marginRight: 6,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 15,
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
});

export default TyrePunctureScreen;