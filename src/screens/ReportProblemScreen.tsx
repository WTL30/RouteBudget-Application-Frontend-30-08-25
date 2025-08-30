// import AsyncStorage from "@react-native-async-storage/async-storage";
// import React, { useEffect, useState } from "react";
// import { 
//   View, 
//   Text, 
//   TextInput, 
//   TouchableOpacity, 
//   Image, 
//   StyleSheet, 
//   Alert, 
//   ScrollView, 
//   PermissionsAndroid, 
//   Dimensions, 
//   StatusBar,
//   ActivityIndicator,
//   Animated,
//   Platform
// } from "react-native";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import { Appbar } from "react-native-paper";
// import axios from "react-native-axios";
// import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
// import Icon from 'react-native-vector-icons/FontAwesome';

// const { width, height } = Dimensions.get('window');

// interface OtherProblems {
//   details: string;
//   amount: string;
// }

// interface Errors {
//   details?: string;
//   amount?: string;
//   image?: string;
// }

// interface ReportProblemScreenProps {
//   navigation: any;
// }

// const ReportProblemScreen: React.FC<ReportProblemScreenProps> = ({ navigation }) => {
//   const [uploadedImage, setUploadedImage] = useState<string | null>(null);
//   const [otherProblems, setOtherProblems] = useState<OtherProblems>({ details: "", amount: "" });
//   const [cabNumber, setCabNumber] = useState<string>('');
//   const [isLoading, setIsLoading] = useState<boolean>(false);
//   const [errors, setErrors] = useState<Errors>({});
//   const [fadeAnim] = useState(new Animated.Value(0));
//   const [slideAnim] = useState(new Animated.Value(50));
  
//   // Update the API URL to match the one working in FastTagPaymentScreen
//   const API_BASE_URL = "http://192.168.1.47:5000/";

//   useEffect(() => {
//     getCab();
//     // Animate the screen entrance
//     Animated.parallel([
//       Animated.timing(fadeAnim, {
//         toValue: 1,
//         duration: 800,
//         useNativeDriver: true,
//       }),
//       Animated.timing(slideAnim, {
//         toValue: 0,
//         duration: 600,
//         useNativeDriver: true,
//       }),
//     ]).start();
//   }, []);

//   const requestCameraPermission = async (): Promise<boolean> => {
//     try {
//       if (Platform.OS === 'android') {
//         const granted = await PermissionsAndroid.request(
//           PermissionsAndroid.PERMISSIONS.CAMERA,
//           {
//             title: "Camera Permission",
//             message: "This app needs camera access to take photos for problem reporting.",
//             buttonPositive: "Allow",
//             buttonNegative: "Deny",
//           }
//         );
//         return granted === PermissionsAndroid.RESULTS.GRANTED;
//       }
//       return true;
//     } catch (err) {
//       console.warn(err);
//       return false;
//     }
//   };

//    const openCamera = async () => {
//       const hasPermission = await requestCameraPermission();
//       if (!hasPermission) {
//         Alert.alert("Permission Denied", "You need to allow camera access to take pictures.");
//         return;
//       }
    
//       const options = { 
//         mediaType: "photo" as const, 
//         maxWidth: 800,
//         maxHeight: 800,
//         quality: 0.7,
//         includeBase64: false,
//       };
      
//       launchCamera(options, (response) => {
//         if (response.didCancel) {
//           return;
//         } else if (response.errorCode) {
//           console.error("Camera error:", response.errorCode);
//         } else if (response.assets && response.assets.length > 0) {
//           setUploadedImage(response.assets[0].uri || null);
//           setErrors({...errors, image: ''});
//         }
//       });
//     };

//   const openGallery = async (): Promise<void> => {
//     const options = { 
//       mediaType: 'photo' as const, 
//       maxWidth: 1200, 
//       maxHeight: 1200, 
//       quality: 0.8 
//     };
    
//     try {
//       const result = await launchImageLibrary(options);
//       if (result.assets && result.assets[0]) {
//         setUploadedImage(result.assets[0].uri || null);
//         setErrors({...errors, image: undefined});
//       }
//     } catch (error) {
//       Alert.alert("Error", "Failed to select image from gallery.");
//     }
//   };

//   const goBack = (): void => {
//     navigation.goBack();
//   };

//   const getCab = async (): Promise<void> => {
//     try {
//       const token = await AsyncStorage.getItem("userToken");

//       if (token) {
//         const response = await axios.get("http://192.168.1.47:5000/api/assignCab/driver", {
//           headers: { Authorization: `Bearer ${token}` }
//         });

//         if (response.data.length > 0) {
//           setCabNumber(response.data[0].CabsDetail.cabNumber || '');
//         }
//       }
//     } catch (error) {
//       Alert.alert("Error", "Failed to fetch assigned cab data. Please try again.");
//     }
//   };

//  const validateForm = (): boolean => {
//   const newErrors: Errors = {};

//   if (!otherProblems.amount.trim()) {
//     newErrors.amount = "Please enter the repair cost";
//   } else if (isNaN(Number(otherProblems.amount)) || Number(otherProblems.amount) <= 0) {
//     newErrors.amount = "Please enter a valid amount";
//   }

//   if (!uploadedImage) {
//     newErrors.image = "Please upload an image of the problem";
//   }

//   if (!cabNumber) {
//     Alert.alert("Error", "Unable to identify your assigned cab. Please try again later.");
//     return false;
//   }

//   setErrors(newErrors);
//   return Object.keys(newErrors).length === 0;
// };


//   const handleReportProblem = async (): Promise<void> => {
//     if (!validateForm()) {
//       return;
//     }

//     setIsLoading(true);
    
//     try {
//       const formData = new FormData();
//       formData.append("otherProblems", JSON.stringify(otherProblems));
      
//       if (uploadedImage) {
//         formData.append("otherProblemsImage", {
//           uri: uploadedImage,
//           type: "image/jpeg",
//           name: "problem_report_image.jpg",
//         } as any);
//       }
      
//       const token = await AsyncStorage.getItem("userToken");


//       setTimeout(()=>{
//         Alert.alert(
//         "Success", 
//         "Your problem has been reported successfully! Our team will review it shortly.", 
//         [
//           {
//             text: "OK",
//             onPress: () => navigation.navigate("Home"),
//           },
//         ]
//       );
//       setIsLoading(false);

//       },1000)

//       const res = await axios.patch(
//         "http://192.168.1.47:5000/api/assigncab/update-trip",
//         formData,
//         {
//           headers: {
//             "Content-Type": "multipart/form-data",
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

      
      
//       // Reset form after successful submission
//       setOtherProblems({ details: "", amount: "" });
//       setUploadedImage(null);
//       setErrors({});
//     } catch (error: any) {
//       Alert.alert(
//         "Submission Failed", 
//         `Unable to submit your report at this time. ${error.response ? `Error: ${error.response.status}` : "Please check your connection and try again."}`
//       );
//     } finally {
//       // setIsLoading(false);
//     }
//   };

//   const selectImage = (): void => {
//     Alert.alert(
//       "Add Supporting Image",
//       "Choose how you'd like to add visual documentation to your report",
//       [
//         { text: "Take New Photo", onPress: openCamera, style: "default" },
//         // { text: "Select from Gallery", onPress: openGallery, style: "default" },
//         { text: "Cancel", style: "cancel" }
//       ],
//       { cancelable: true }
//     );
//   };

//   return (
//     <View style={styles.mainContainer}>
//       <StatusBar backgroundColor="#4F46E5" barStyle="light-content" />
      
//       {/* Header */}
//       <Appbar.Header style={styles.header}>
//         <Appbar.BackAction onPress={goBack} color="#fff" />
//         <Appbar.Content title="Problem Report" titleStyle={styles.headerTitle} />
//         <TouchableOpacity style={styles.helpButton}>
//           <MaterialIcons name="help-outline" size={24} color="#fff" />
//         </TouchableOpacity>
//       </Appbar.Header>

//       <Animated.View 
//         style={[
//           styles.container, 
//           { 
//             opacity: fadeAnim,
//             transform: [{ translateY: slideAnim }]
//           }
//         ]}
//       >
//         <ScrollView 
//           contentContainerStyle={styles.scrollContainer}
//           showsVerticalScrollIndicator={false}
//         >
//           {/* Cab Information Card */}
//           <View style={styles.cabInfoCard}>
//             <View style={styles.cabIconContainer}>
//               <MaterialIcons name="build" size={28} color="#4F46E5" />
//             </View>
//             <View style={styles.cabInfoContent}>
//               <Text style={styles.cabNumber}>{cabNumber || 'Loading...'}</Text>
//               <Text style={styles.cabLabel}>Problem Report</Text>
//             </View>
//             <View style={styles.statusBadge}>
//               <Text style={styles.statusText}>Report</Text>
//             </View>
//           </View>

//           {/* Instructions Card */}
//           <View style={styles.instructionsCard}>
//             <View style={styles.instructionHeader}>
//               <View style={styles.infoIconContainer}>
//                 <MaterialIcons name="info" size={20} color="#fff" />
//               </View>
//               <Text style={styles.instructionTitle}>Important Instructions</Text>
//             </View>
//             <Text style={styles.instructionText}>
//               Please upload clear images of the problem and provide the accurate repair cost estimate for processing.
//             </Text>
//           </View>

//           {/* Image Upload Section */}
//           <View style={styles.uploadSection}>
//             <View style={styles.uploadHeader}>
//               <MaterialIcons name="camera-alt" size={24} color="#1F2937" />
//               <Text style={styles.uploadTitle}>Upload Problem Images</Text>
//             </View>
            
//             <TouchableOpacity 
//               style={styles.uploadContainer} 
//               onPress={selectImage}
//               activeOpacity={0.8}
//             >
//               {uploadedImage ? (
//                 <View style={styles.imageContainer}>
//                   <Image source={{ uri: uploadedImage }} style={styles.previewImage} />
//                   <View style={styles.imageOverlay}>
//                     <TouchableOpacity 
//                       style={styles.removeImageButton} 
//                       onPress={() => setUploadedImage(null)}
//                     >
//                       <MaterialIcons name="close" size={16} color="#fff" />
//                     </TouchableOpacity>
//                   </View>
//                 </View>
//               ) : (
//                 <View style={styles.uploadPlaceholder}>
//                   <View style={styles.uploadIconContainer}>
//                     <MaterialIcons name="cloud-upload" size={40} color="#4F46E5" />
//                   </View>
//                   <Text style={styles.uploadMainText}>Upload Problem Image</Text>
//                   <Text style={styles.uploadSubText}>Tap to take photo or choose from gallery</Text>
//                 </View>
//               )}
//             </TouchableOpacity>
//           </View>

//           {/* Repair Cost Section */}
//           <View style={styles.costSection}>
//             <View style={styles.costHeader}>
//               <MaterialIcons name="attach-money" size={24} color="#1F2937" />
//               <Text style={styles.costTitle}>Repair Cost</Text>
//             </View>
            
//             <View style={styles.costInputContainer}>
//               <Text style={styles.currencySymbol}>₹</Text>
//               <TextInput
//                 placeholder="Enter repair cost estimate"
//                 style={[styles.costInput, errors.amount && styles.inputError]}
//                 value={otherProblems.amount}
//                 keyboardType="numeric"
//                 onChangeText={(text) => {
//                   setOtherProblems({ ...otherProblems, amount: text });
//                   if (errors.amount) {
//                     setErrors({...errors, amount: undefined});
//                   }
//                 }}
//                 placeholderTextColor="#9CA3AF"
//               />
//             </View>
//             {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
//           </View>

//           {/* Problem Details Section */}
//           <View style={styles.detailsSection}>
//             <View style={styles.detailsHeader}>
//               <MaterialIcons name="description" size={24} color="#1F2937" />
//               <Text style={styles.detailsTitle}>Problem Details</Text>
//             </View>
            
//             <TextInput
//               placeholder="Describe the problem in detail..."
//               style={[styles.detailsInput, errors.details && styles.inputError]}
//               multiline
//               numberOfLines={4}
//               value={otherProblems.details}
//               onChangeText={(text) => {
//                 setOtherProblems({ ...otherProblems, details: text });
//                 if (errors.details) {
//                   setErrors({...errors, details: undefined});
//                 }
//               }}
//               placeholderTextColor="#9CA3AF"
//               textAlignVertical="top"
//             />
//             {errors.details && <Text style={styles.errorText}>{errors.details}</Text>}
//           </View>
//         </ScrollView>

//         {/* Submit Button */}
//         <View style={styles.buttonContainer}>
//           <TouchableOpacity 
//             style={[
//               styles.submitButton, 
//               isLoading && styles.disabledButton,
//               (!uploadedImage || !otherProblems.amount.trim()) && styles.disabledButton
//             ]} 
//             onPress={handleReportProblem}
//             disabled={isLoading || !uploadedImage || !otherProblems.amount.trim()}
//             activeOpacity={0.8}
//           >
//             {isLoading ? (
//               <View style={styles.loadingContainer}>
//                 <ActivityIndicator size="small" color="#fff" />
//                 <Text style={styles.submitButtonText}>Submitting...</Text>
//               </View>
//             ) : (
//               <>
//                 <MaterialIcons name="send" size={20} color="#fff" />
//                 <Text style={styles.submitButtonText}>Submit Report</Text>
//               </>
//             )}
//           </TouchableOpacity>
//         </View>
//       </Animated.View>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   mainContainer: {
//     flex: 1,
//     backgroundColor: "#F3F4F6",
//   },
//   container: {
//     flex: 1,
//     backgroundColor: "#F3F4F6",
//   },
//   header: { 
//     backgroundColor: "#4F46E5",
//     elevation: 0,
//     shadowOpacity: 0,
//   },
//   headerTitle: {
//     fontSize: 18,
//     fontWeight: "600",
//     color: "#fff",
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//   },
//   helpButton: {
//     marginRight: 8,
//   },
//   scrollContainer: {
//     flexGrow: 1,
//     paddingHorizontal: 16,
//     paddingTop: 16,
//     paddingBottom: 100,
//   },
//   cabInfoCard: {
//     flexDirection: "row",
//     alignItems: "center",
//     backgroundColor: "#fff",
//     padding: 20,
//     borderRadius: 16,
//     marginBottom: 16,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.1,
//     shadowRadius: 8,
//     elevation: 4,
//   },
//   cabIconContainer: {
//     width: 50,
//     height: 50,
//     backgroundColor: "#EEF2FF",
//     borderRadius: 25,
//     alignItems: "center",
//     justifyContent: "center",
//     marginRight: 16,
//   },
//   cabInfoContent: {
//     flex: 1,
//   },
//   cabNumber: {
//     fontSize: 18,
//     fontWeight: "700",
//     color: "#1F2937",
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//     marginBottom: 2,
//   },
//   cabLabel: {
//     fontSize: 14,
//     color: "#6B7280",
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//   },
//   statusBadge: {
//     backgroundColor: "#FEF3C7",
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     borderRadius: 12,
//   },
//   statusText: {
//     fontSize: 12,
//     fontWeight: "600",
//     color: "#92400E",
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//   },
//   instructionsCard: {
//     backgroundColor: "#fff",
//     padding: 20,
//     borderRadius: 16,
//     marginBottom: 20,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.1,
//     shadowRadius: 8,
//     elevation: 4,
//   },
//   instructionHeader: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginBottom: 12,
//   },
//   infoIconContainer: {
//     width: 24,
//     height: 24,
//     backgroundColor: "#4F46E5",
//     borderRadius: 12,
//     alignItems: "center",
//     justifyContent: "center",
//     marginRight: 12,
//   },
//   instructionTitle: {
//     fontSize: 16,
//     fontWeight: "600",
//     color: "#1F2937",
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//   },
//   instructionText: {
//     fontSize: 14,
//     color: "#6B7280",
//     lineHeight: 20,
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//   },
//   uploadSection: {
//     marginBottom: 20,
//   },
//   uploadHeader: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginBottom: 12,
//   },
//   uploadTitle: {
//     fontSize: 18,
//     fontWeight: "600",
//     color: "#1F2937",
//     marginLeft: 8,
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//   },
//   uploadContainer: {
//     backgroundColor: "#fff",
//     borderRadius: 16,
//     borderWidth: 2,
//     borderColor: "#E5E7EB",
//     borderStyle: "dashed",
//     overflow: "hidden",
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.05,
//     shadowRadius: 8,
//     elevation: 2,
//   },
//   uploadPlaceholder: {
//     alignItems: "center",
//     paddingVertical: 40,
//     paddingHorizontal: 20,
//   },
//   uploadIconContainer: {
//     width: 80,
//     height: 80,
//     backgroundColor: "#EEF2FF",
//     borderRadius: 40,
//     alignItems: "center",
//     justifyContent: "center",
//     marginBottom: 16,
//   },
//   uploadMainText: {
//     fontSize: 18,
//     fontWeight: "600",
//     color: "#1F2937",
//     marginBottom: 4,
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//   },
//   uploadSubText: {
//     fontSize: 14,
//     color: "#6B7280",
//     textAlign: "center",
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//   },
//   imageContainer: {
//     position: "relative",
//   },
//   previewImage: { 
//     width: "100%",
//     height: 200,
//     resizeMode: "cover",
//   },
//   imageOverlay: {
//     position: "absolute",
//     top: 12,
//     right: 12,
//   },
//   removeImageButton: {
//     backgroundColor: "rgba(239, 68, 68, 0.9)",
//     width: 32,
//     height: 32,
//     borderRadius: 16,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   costSection: {
//     marginBottom: 20,
//   },
//   costHeader: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginBottom: 12,
//   },
//   costTitle: {
//     fontSize: 18,
//     fontWeight: "600",
//     color: "#1F2937",
//     marginLeft: 8,
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//   },
//   costInputContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     borderWidth: 1,
//     borderColor: "#E5E7EB",
//     paddingHorizontal: 16,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.05,
//     shadowRadius: 8,
//     elevation: 2,
//   },
//   currencySymbol: {
//     fontSize: 18,
//     fontWeight: "600",
//     color: "#1F2937",
//     marginRight: 8,
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//   },
//   costInput: {
//     flex: 1,
//     paddingVertical: 16,
//     fontSize: 16,
//     color: "#1F2937",
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//   },
//   detailsSection: {
//     marginBottom: 20,
//   },
//   detailsHeader: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginBottom: 12,
//   },
//   detailsTitle: {
//     fontSize: 18,
//     fontWeight: "600",
//     color: "#1F2937",
//     marginLeft: 8,
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//   },
//   detailsInput: {
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 16,
//     borderRadius: 12,
//     fontSize: 16,
//     borderWidth: 1,
//     borderColor: "#E5E7EB",
//     minHeight: 120,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.05,
//     shadowRadius: 8,
//     elevation: 2,
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//     color: "#1F2937",
//   },
//   inputError: {
//     borderColor: "#EF4444",
//     borderWidth: 2,
//   },
//   errorText: {
//     color: "#EF4444",
//     fontSize: 14,
//     marginTop: 8,
//     fontWeight: "500",
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//   },
//   buttonContainer: {
//     position: "absolute",
//     bottom: 0,
//     left: 0,
//     right: 0,
//     backgroundColor: "#F3F4F6",
//     paddingHorizontal: 16,
//     paddingVertical: 16,
//   },
//   submitButton: {
//     backgroundColor: "#4F46E5",
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     paddingVertical: 16,
//     borderRadius: 12,
//     gap: 8,
//     shadowColor: "#4F46E5",
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.3,
//     shadowRadius: 8,
//     elevation: 6,
//   },
//   disabledButton: {
//     backgroundColor: "#9CA3AF",
//     shadowOpacity: 0,
//     elevation: 0,
//   },
//   submitButtonText: {
//     fontSize: 16,
//     color: "#fff",
//     fontWeight: "600",
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//   },
//   loadingContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 8,
//   },
// });

// export default ReportProblemScreen;


"use client"

import AsyncStorage from "@react-native-async-storage/async-storage"
import type React from "react"
import { useEffect, useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  PermissionsAndroid,
  Dimensions,
  ActivityIndicator,
  Platform,
} from "react-native"
import MaterialIcons from "react-native-vector-icons/MaterialIcons"
import axios from "react-native-axios"
import { launchCamera } from "react-native-image-picker"

const { width } = Dimensions.get("window")

interface OtherProblems {
  details: string
  amount: string
}

interface Errors {
  details?: string
  amount?: string
  image?: string
}

interface ReportProblemScreenProps {
  onClose?: () => void
  navigation?: any
}

const ReportProblemScreen: React.FC<ReportProblemScreenProps> = ({ onClose, navigation }) => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [otherProblems, setOtherProblems] = useState<OtherProblems>({ details: "", amount: "" })
  const [cabNumber, setCabNumber] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    getCab()
  }, [])

  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
          title: "Camera Permission",
          message: "This app needs camera access to take photos for problem reporting.",
          buttonPositive: "Allow",
          buttonNegative: "Deny",
        })
        return granted === PermissionsAndroid.RESULTS.GRANTED
      }
      return true
    } catch (err) {
      console.warn(err)
      return false
    }
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

  const getCab = async (): Promise<void> => {
    try {
      const token = await AsyncStorage.getItem("userToken")

      if (token) {
        const response = await axios.get("https://api.routebudget.com/api/assignCab/driver", {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (response.data.length > 0) {
          setCabNumber(response.data[0].CabsDetail.cabNumber || "")
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to fetch assigned cab data. Please try again.")
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Errors = {}

    if (!otherProblems.amount.trim()) {
      newErrors.amount = "Please enter the repair cost"
    } else if (isNaN(Number(otherProblems.amount)) || Number(otherProblems.amount) <= 0) {
      newErrors.amount = "Please enter a valid amount"
    }

    if (!uploadedImage) {
      newErrors.image = "Please upload an image of the problem"
    }

    if (!cabNumber) {
      Alert.alert("Error", "Unable to identify your assigned cab. Please try again later.")
      return false
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleReportProblem = async (): Promise<void> => {
    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const formData = new FormData()

      // Only append the data once - choose the format your backend expects
      // Option 1: Send as JSON object (recommended)
      const otherProblemsData = {
        amount: otherProblems.amount,
        details: otherProblems.details,
      }
      formData.append("otherProblems", JSON.stringify(otherProblemsData))

      // Option 2: Or send as separate fields (uncomment if your backend expects this format)
      // formData.append("otherAmount", otherProblems.amount)
      // formData.append("otherDetails", otherProblems.details)

      if (uploadedImage) {
        formData.append("otherProblemsImage", {
          uri: uploadedImage,
          type: "image/jpeg",
          name: "problem_report_image.jpg",
        } as any)
      }

      const token = await AsyncStorage.getItem("userToken")

      const res = await axios.patch("https://api.routebudget.com/api/assigncab/update-trip", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      })

      Alert.alert("Success", "Your problem has been reported successfully!", [
        {
          text: "OK",
          onPress: () => {
            setOtherProblems({ details: "", amount: "" })
            setUploadedImage(null)
            setErrors({})

            if (onClose) {
              onClose()
            } else if (navigation) {
              navigation.navigate("Home")
            }
          },
        },
      ])
    } catch (error: any) {
      console.error("Submission error:", error)
      Alert.alert(
        "Submission Failed",
        `Unable to submit your report. ${error.response ? `Error: ${error.response.status}` : "Please check your connection and try again."}`,
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Upload Photo */}
      <TouchableOpacity
        style={[styles.uploadContainer, errors.image && styles.uploadError]}
        onPress={openCamera}
        activeOpacity={0.8}
      >
        {uploadedImage ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: uploadedImage }} style={styles.previewImage} />
            <TouchableOpacity style={styles.changeButton} onPress={openCamera} activeOpacity={0.7}>
              <MaterialIcons name="camera-alt" size={14} color="#FFFFFF" />
              <Text style={styles.changeButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.uploadContent}>
            <View style={styles.uploadCircle}>
              <MaterialIcons name="camera-alt" size={24} color="#ffffff" />
            </View>
            <Text style={styles.uploadText}>Take Photo</Text>
          </View>
        )}
      </TouchableOpacity>
      {errors.image && <Text style={styles.errorText}>{errors.image}</Text>}

      {/* Amount */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          <MaterialIcons name="currency-rupee" size={16} color="#FFA726" /> Amount *
        </Text>
        <View style={[styles.inputWrapper, errors.amount && styles.inputError]}>
          <TextInput
            style={styles.textInput}
            value={otherProblems.amount}
            keyboardType="decimal-pad"
            onChangeText={(text) => {
              const numericText = text.replace(/[^0-9.]/g, "")
              setOtherProblems({ ...otherProblems, amount: numericText })
              if (errors.amount) {
                setErrors({ ...errors, amount: undefined })
              }
            }}
            placeholder="Enter repair cost"
            placeholderTextColor="#999"
          />
        </View>
        {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
      </View>

      {/* Description */}
      {/* <View style={styles.inputGroup}>
        <Text style={styles.label}>
          <MaterialIcons name="description" size={16} color="#FFA726" /> Description (Optional)
        </Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.textInput, styles.multilineInput]}
            multiline
            numberOfLines={2}
            value={otherProblems.details}
            onChangeText={(text) => setOtherProblems({ ...otherProblems, details: text })}
            placeholder="Describe the problem..."
            placeholderTextColor="#999"
            textAlignVertical="top"
          />
        </View>
      </View> */}

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          (!uploadedImage || !otherProblems.amount.trim() || isLoading) && styles.submitButtonDisabled,
        ]}
        onPress={handleReportProblem}
        disabled={!uploadedImage || !otherProblems.amount.trim() || isLoading}
        activeOpacity={0.8}
      >
        <View style={styles.submitGradient}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="check" size={16} color="#FFFFFF" />
              <Text style={styles.submitText}>Submit Report</Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 7,
    paddingTop: 0,
  },
  uploadContainer: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#FFB74D",
    borderRadius: 12,
    padding: 5,
    alignItems: "center",
    backgroundColor: "#FFF8E1",
    marginBottom: 5,
  },
  uploadError: {
    borderColor: "#f44336",
  },
  uploadContent: {
    alignItems: "center",
  },
  uploadCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFA726",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    elevation: 3,
  },
  uploadText: {
    fontSize: 14,
    color: "#FFA726",
    fontWeight: "600",
  },
  imageContainer: {
    alignItems: "center",
    width: "100%",
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 3,
  },
  changeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFA726",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  changeButtonText: {
    color: "#FFFFFF",
    marginLeft: 4,
    fontSize: 11,
    fontWeight: "600",
  },
  inputGroup: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFA726",
    marginBottom: 6,
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderColor: "#FFB74D",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    elevation: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  inputError: {
    borderColor: "#f44336",
  },
  textInput: {
    flex: 1,
    height: 42,
    fontSize: 15,
    color: "#333",
    marginLeft: 6,
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  errorText: {
    color: "#f44336",
    fontSize: 11,
    marginTop: 4,
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
    backgroundColor: "#FFA726",
  },
  submitText: {
    fontSize: 15,
    color: "#fff",
    fontWeight: "600",
    marginLeft: 6,
  },
})

export default ReportProblemScreen