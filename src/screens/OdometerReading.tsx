// import React, { useEffect, useState } from 'react';
// import { 
//   View, 
//   Text, 
//   StyleSheet, 
//   TouchableOpacity, 
//   TextInput,
//   Image,
//   Alert,
//   ScrollView,
//   PermissionsAndroid,
//   ActivityIndicator,
//   Dimensions,
//   StatusBar,
//   SafeAreaView
// } from 'react-native';
// import Icon from 'react-native-vector-icons/FontAwesome';
// import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
// import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import axios from "react-native-axios";
// import { useNavigation } from '@react-navigation/native';
// import LinearGradient from 'react-native-linear-gradient';

// const { width } = Dimensions.get('window');

// const OdometerReading = () => {
//   const navigation = useNavigation();
//   const [odometerReading, setOdometerReading] = useState({details:"",meter:""});
//   const [uploadedImage, setUploadedImage] = useState(null);
//   const [cabNumber, setCabNumber] = useState('');
//   const [errors, setErrors] = useState({});
//   const [isLoading, setIsLoading] = useState(false);

//   const requestCameraPermission = async () => {
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

//     const openCamera = async () => {
//       const hasPermission = await requestCameraPermission();
//       if (!hasPermission) {
//         Alert.alert("Permission Denied", "You need to allow camera access to take pictures.");
//         return;
//       }
    
//       // Optimized options for faster processing
//       const options = { 
//         mediaType: "photo", 
//         maxWidth: 800,     // Reduced from 1200
//         maxHeight: 800,    // Reduced from 1200
//         quality: 0.6,      // Reduced from 0.8 for faster upload
//         includeBase64: false, // Don't include base64 data (faster)
//       };
      
//       launchCamera(options, (response) => {
//         if (response.didCancel) {
//           // User cancelled camera
//         } else if (response.errorCode) {
//           // Error occurred
//         } else if (response.assets && response.assets.length > 0) {
//           setUploadedImage(response.assets[0].uri);
//           setErrors({...errors, image: null});
//         }
//       });
//     };

//   const openGallery = async () => {
//     const options = { mediaType: 'photo', maxWidth: 1200, maxHeight: 1200, quality: 0.8 };
//     try {
//       const result = await launchImageLibrary(options);
//       if (result.assets && result.assets[0]) {
//         setUploadedImage(result.assets[0].uri);
//         setErrors({...errors, image: null});
//       }
//     } catch (error) {
//     }
//   };

//   useEffect(() => { getCab(); }, []);

//   const getCab = async () => {
//     try {
//       setIsLoading(true);
//       const token = await AsyncStorage.getItem("userToken");
//       if (token) {
//         const response = await axios.get("http://192.168.1.25:5000.com/api/assignCab/driver", {
//           headers: { Authorization: `Bearer ${token}` }
//         });
        
//         if (response.data.length > 0) {
//           setCabNumber(response.data[0]?.cab?.cabNumber);
//         }
//       }
//     } catch (error) {
//       Alert.alert("Error", "Failed to fetch assigned cab data");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const selectImage = () => {
//     Alert.alert(
//       "Upload Odometer Image",
//       "Choose an option",
//       [
//         { text: "Take Photo", onPress: openCamera },
//         // { text: "Choose from Gallery", onPress: openGallery },
//         { text: "Cancel", style: "cancel" }
//       ],
//       { cancelable: true }
//     );
//   };

//   const validateInputs = () => {
//     let newErrors = {};
    
//     if (!uploadedImage) {
//       newErrors.image = 'Please upload an odometer image';
//     }
    
//     if (!odometerReading) {
//       newErrors.odometerReading = 'Please Enter Correct Odometer Reading';
//     }
    
//     setErrors(newErrors);
//     return Object.keys(newErrors).length === 0;
//   };

//   const handleOdometer = async () => {
//     if (!validateInputs()) {
//       Alert.alert("Validation Error", "Please fill all required fields correctly");
//       return;
//     }
  
//    if(cabNumber){
//     try {
//       setIsLoading(true);
      
//       const formData = new FormData();
      
  
//       // Ensure 'vehicleServicing' is stringified the same as in Postman
//       formData.append("vehicleServicing", JSON.stringify({
//         details: odometerReading.details,
//         meter: Number(odometerReading.meter),
//       }));
  
//       if (uploadedImage) {
//         const uriParts = uploadedImage.split("/");
//         const fileName = uriParts[uriParts.length - 1];
  
//         formData.append("vehicleServicingImage", {
//           uri: uploadedImage,
//           name: fileName,
//           type: "image/jpeg", // You can dynamically detect this if needed
//         });
//       }
  
//       const token = await AsyncStorage.getItem("userToken");
  
//       const res = await axios.patch(
//         "http://192.168.1.25:5000.com/api/assigncab/update-trip",
//         formData,
//         {
//           headers: {
//             "Content-Type": "multipart/form-data",
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );
  
      
//       Alert.alert("Success", "Odometer reading submitted successfully!", [
//         {
//           text: "OK",
//           onPress: () => navigation.navigate("Home"),
//         },
//       ]);
      
//       // Reset form
//       setOdometerReading({ details: "", meter: "" });
//       setUploadedImage(null);
  
//     } catch (error) {
//       Alert.alert("Error", "Failed to submit Odometer Reading.");
//     } finally {
//       setIsLoading(false);
//     }
//    }else{
//     Alert.alert("No cab assigned to you")
//    }
//   };
  

//   if (isLoading && !cabNumber) {
//     return (
//       <View style={styles.loadingContainer}>
//         <ActivityIndicator size="large" color="#4F46E5" />
//         <Text style={styles.loadingText}>Loading cab data...</Text>
//       </View>
//     );
//   }

//   return (
//     <SafeAreaView style={styles.container}>
//       <StatusBar barStyle="light-content" backgroundColor="#1a237e" />
      
//       <LinearGradient
//         colors={['#1a237e', '#0277bd']}
//         style={styles.headerGradient}
//       >
//         <View style={styles.header}>
//           <TouchableOpacity 
//             style={styles.backButton} 
//             onPress={() => navigation.navigate("Home")}
//           >
//             <MaterialIcons name="arrow-back" size={24} color="#fff" />
//           </TouchableOpacity>
//           <Text style={styles.headerTitle}>Update Odometer Reading</Text>
//           <View style={{ width: 24 }} />
//         </View>
//       </LinearGradient>
      
//       <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
//         <View style={styles.contentContainer}>
//           <View style={styles.cardContainer}>
//             <Text style={styles.sectionTitle}>
//               <Icon name="dashboard" size={20} color="#1a237e" /> Odometer Details
//             </Text>
            
//             <TouchableOpacity 
//               style={[styles.uploadContainer, errors.image && styles.inputError]} 
//               onPress={selectImage}
//               activeOpacity={0.8}
//             >
//               {uploadedImage ? (
//                 <View style={styles.imagePreviewContainer}>
//                   <Image source={{ uri: uploadedImage }} style={styles.previewImage} />
//                   <TouchableOpacity 
//                     style={styles.changeImageButton} 
//                     onPress={selectImage}
//                     activeOpacity={0.7}
//                   >
//                     <Icon name="camera" size={16} color="#FFFFFF" />
//                     <Text style={styles.changeImageText}>Change Photo</Text>
//                   </TouchableOpacity>
//                 </View>
//               ) : (
//                 <>
//                   <View style={styles.uploadCircle}>
//                     <Icon name="camera" size={30} color="#ffffff" />
//                   </View>
//                   <Text style={styles.uploadText}>Take Odometer Photo</Text>
//                   <Text style={styles.uploadSubText}>Tap here to capture</Text>
//                   {errors.image && <Text style={styles.errorText}>{errors.image}</Text>}
//                 </>
//               )}
//             </TouchableOpacity>
            
//             <View style={styles.inputContainer}>
//               <Text style={styles.inputLabel}>
//                 <Icon name="tachometer" size={16} color="#1a237e" /> Odometer Reading
//               </Text>
//               <View style={[styles.textInputContainer, errors.odometerReading && styles.inputError]}>
//                 <TextInput 
//                   style={styles.input}
//                   value={odometerReading.meter} 
//                   onChangeText={(text) => {
//                     setOdometerReading({...odometerReading, meter: text});
//                     setErrors({...errors, odometerReading: null});
//                   }} 
//                   keyboardType="decimal-pad" 
//                   placeholder="Enter current reading" 
//                   placeholderTextColor="#A0AEC0"
//                 />
//               </View>
//               {errors.odometerReading && 
//                 <Text style={styles.errorText}>
//                   <Icon name="exclamation-circle" size={14} color="#EF4444" /> {errors.odometerReading}
//                 </Text>
//               }
//             </View>
//           </View>
//         </View>
//       </ScrollView>
      
//       <View style={styles.footer}>
//         <TouchableOpacity 
//           style={[
//             styles.submitButton,
//             isLoading && styles.submitButtonDisabled
//           ]} 
//           onPress={handleOdometer}
//           disabled={isLoading}
//           activeOpacity={0.8}
//         >
//           {isLoading ? (
//             <ActivityIndicator size="small" color="#FFFFFF" />
//           ) : (
//             <LinearGradient
//               colors={['#1a237e', '#0277bd']}
//               style={styles.submitGradient}
//             >
//               <Icon name="check" size={18} color="#FFFFFF" style={styles.submitIcon} />
//               <Text style={styles.submitText}>Submit Reading</Text>
//             </LinearGradient>
//           )}
//         </TouchableOpacity>
//       </View>
//     </SafeAreaView>
//   );
// };

// // Update the styles
// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#F9FAFB",
//   },
//   contentContainer: {
//     flex: 1,
//     paddingBottom: 100, // Space for fixed button
//   },
//   scrollView: {
//     flex: 1,
//     backgroundColor: "#F9FAFB",
//   },
//   loadingContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: "#F9FAFB",
//   },
//   loadingText: {
//     marginTop: 10,
//     color: "#4F46E5",
//     fontSize: 16,
//   },
//   headerGradient: {
//     paddingTop: 20,
//     paddingBottom: 15,
//     borderBottomLeftRadius: 25,
//     borderBottomRightRadius: 25,
//     elevation: 8,
//   },
//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 20,
//   },
//   headerTitle: {
//     fontSize: 20,
//     fontWeight: "700",
//     color: "#fff",
//     letterSpacing: 0.5,
//   },
//   cardContainer: {
//     backgroundColor: "#FFFFFF",
//     marginHorizontal: 16,
//     marginTop: 20,
//     borderRadius: 20,
//     padding: 20,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.1,
//     shadowRadius: 8,
//     elevation: 5,
//   },
//   uploadContainer: {
//     borderWidth: 2,
//     borderStyle: "dashed",
//     borderColor: "#1a237e",
//     borderRadius: 15,
//     padding: 25,
//     alignItems: "center",
//     backgroundColor: "#F8FAFF",
//     marginBottom: 25,
//   },
//   uploadCircle: {
//     width: 70,
//     height: 70,
//     borderRadius: 35,
//     backgroundColor: "#1a237e",
//     alignItems: "center",
//     justifyContent: "center",
//     marginBottom: 15,
//     elevation: 4,
//   },
//   uploadText: {
//     fontSize: 18,
//     color: "#1a237e",
//     fontWeight: "600",
//     marginBottom: 5,
//   },
//   uploadSubText: {
//     fontSize: 14,
//     color: "#64748B",
//   },
//   textInputContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//     borderWidth: 1.5,
//     borderColor: "#E2E8F0",
//     borderRadius: 12,
//     backgroundColor: "#FFFFFF",
//     marginTop: 8,
//     paddingHorizontal: 15,
//     elevation: 2,
//   },
//   input: {
//     flex: 1,
//     height: 55,
//     fontSize: 16,
//     color: "#1F2937",
//   },
//   submitGradient: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     width: '100%',
//     height: '100%',
//     borderRadius: 12,
//   },
//   submitButton: {
//     height: 56,
//     borderRadius: 12,
//     overflow: 'hidden',
//   },
//   submitButtonDisabled: {
//     opacity: 0.7,
//   },
//   errorText: {
//     color: "#EF4444",
//     fontSize: 14,
//     marginTop: 4,
//   },
//   inputError: {
//     borderColor: "#EF4444",
//   },
// });

// export default OdometerReading;






//OdodmeterReading.


"use client"

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
} from "react-native"
import MaterialIcons from "react-native-vector-icons/MaterialIcons"
import { launchImageLibrary, launchCamera } from "react-native-image-picker"
import AsyncStorage from "@react-native-async-storage/async-storage"
import axios from "react-native-axios"
import LinearGradient from "react-native-linear-gradient"

const OdometerReading = ({ onClose }) => {
  const [servicingMeter, setServicingMeter] = useState("")
  const [uploadedImage, setUploadedImage] = useState(null)
  const [cabNumber, setCabNumber] = useState("")
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)

  // ... existing code for permissions and functions ...

  const requestCameraPermission = async () => {
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

  const openCamera = async () => {
    const hasPermission = await requestCameraPermission()
    if (!hasPermission) {
      Alert.alert("Permission Denied", "You need to allow camera access to take pictures.")
      return
    }

    const options = {
      mediaType: "photo",
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.6,
      includeBase64: false,
    }

    launchCamera(options, (response) => {
      if (response.didCancel) {
        // User cancelled camera
      } else if (response.errorCode) {
        // Error occurred
      } else if (response.assets && response.assets.length > 0) {
        setUploadedImage(response.assets[0].uri)
        setErrors({ ...errors, image: null })
      }
    })
  }

  const openGallery = async () => {
    const options = { mediaType: "photo", maxWidth: 1200, maxHeight: 1200, quality: 0.8 }
    try {
      const result = await launchImageLibrary(options)
      if (result.assets && result.assets[0]) {
        setUploadedImage(result.assets[0].uri)
        setErrors({ ...errors, image: null })
      }
    } catch (error) {
      console.error("Gallery error:", error)
    }
  }

  useEffect(() => {
    getCab()
  }, [])

  const getCab = async () => {
    try {
      setIsLoading(true)
      const token = await AsyncStorage.getItem("userToken")
      if (token) {
        const response = await axios.get("http://192.168.1.25:5000/api/assignCab/driver", {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (response.data.length > 0) {
          setCabNumber(response.data[0].CabsDetail.cabNumber)
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to fetch assigned cab data")
    } finally {
      setIsLoading(false)
    }
  }

  const selectImage = () => {
    Alert.alert(
      "Upload Odometer Image",
      "Choose an option",
      [
        { text: "Take Photo", onPress: openCamera },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true },
    )
  }

  const validateInputs = () => {
    const newErrors = {}

    if (!uploadedImage) {
      newErrors.image = "Please upload an odometer image"
    }

    if (!servicingMeter || servicingMeter.trim() === "") {
      newErrors.servicingMeter = "Please enter the odometer reading"
    } else if (isNaN(Number(servicingMeter))) {
      newErrors.servicingMeter = "Please enter a valid number"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleOdometer = async () => {
    if (!validateInputs()) {
      Alert.alert("Validation Error", "Please fill all required fields correctly")
      return
    }

    if (cabNumber) {
      try {
        setIsLoading(true)

        const formData = new FormData()
        formData.append("servicingMeter", servicingMeter)

        if (uploadedImage) {
          const uriParts = uploadedImage.split("/")
          const fileName = uriParts[uriParts.length - 1]

          formData.append("vehicleServicingImage", {
            uri: uploadedImage,
            name: fileName,
            type: "image/jpeg",
          })
        }

        const token = await AsyncStorage.getItem("userToken")

        const res = await axios.patch("http://192.168.1.25:5000/api/assigncab/update-trip", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        })

        Alert.alert("Success", "Odometer reading submitted successfully!", [
          {
            text: "OK",
            onPress: () => {
              setServicingMeter("")
              setUploadedImage(null)
              setErrors({})
              if (onClose) onClose()
            },
          },
        ])
      } catch (error) {
        console.error("Submit error:", error)
        Alert.alert("Error", "Failed to submit Odometer Reading.")
      } finally {
        setIsLoading(false)
      }
    } else {
      Alert.alert("No cab assigned to you")
    }
  }

  if (isLoading && !cabNumber) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF8F00" />
        <Text style={styles.loadingText}>Loading cab data...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.contentSection}>
        {/* <Text style={styles.sectionTitle}>
          <MaterialIcons name="dashboard" size={18} color="#FF8F00" /> Odometer Details
        </Text> */}

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

        {/* Odometer Reading Input - Compact */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            <MaterialIcons name="speed" size={16} color="#FF8F00" /> Reading
          </Text>
          <View style={[styles.textInputContainer, errors.servicingMeter && styles.inputError]}>
            <TextInput
              style={styles.input}
              value={servicingMeter}
              onChangeText={(text) => {
                setServicingMeter(text)
                setErrors({ ...errors, servicingMeter: null })
              }}
              keyboardType="decimal-pad"
              placeholder="Enter reading"
              placeholderTextColor="#999"
            />
          </View>
          {errors.servicingMeter && (
            <Text style={styles.errorText}>
              <MaterialIcons name="error" size={12} color="#f44336" /> {errors.servicingMeter}
            </Text>
          )}
        </View>

        {/* Submit Button - Compact */}
        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleOdometer}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <LinearGradient colors={["#FFA726", "#FF8F00"]} style={styles.submitGradient}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="check" size={16} color="#FFFFFF" style={styles.submitIcon} />
                <Text style={styles.submitText}>Submit Reading</Text>
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
    padding: 7, // Reduced from 20 to 12
    paddingTop:0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    marginTop: 8,
    color: "#FF8F00",
    fontSize: 14, // Reduced from 16
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 16, // Reduced from 18
    fontWeight: "600",
    color: "#FF8F00",
    marginBottom: 5, // Reduced from 20
    textAlign: "center",
  },
  uploadContainer: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#FFB74D",
    borderRadius: 12, // Reduced from 15
    padding: 5, // Reduced from 25
    alignItems: "center",
    backgroundColor: "#FFF8E1",
    marginBottom: 5, // Reduced from 20
  },
  uploadCircle: {
    width: 40, // Reduced from 60
    height: 40, // Reduced from 60
    borderRadius: 22.5,
    backgroundColor: "#FF8F00",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8, // Reduced from 12
    elevation: 3,
  },
  uploadText: {
    fontSize: 14, // Reduced from 16
    color: "#FF8F00",
    fontWeight: "600",
  },
  imagePreviewContainer: {
    alignItems: "center",
    width: "100%",
  },
  previewImage: {
    width: 80, // Reduced from 150
    height: 80, // Reduced from 150
    borderRadius: 8, // Reduced from 10
    marginBottom: 3, // Reduced from 12
  },
  changeImageButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF8F00",
    paddingHorizontal: 10, // Reduced from 12
    paddingVertical: 4, // Reduced from 6
    borderRadius: 12, // Reduced from 15
  },
  changeImageText: {
    color: "#FFFFFF",
    marginLeft: 4, // Reduced from 6
    fontSize: 11, // Reduced from 12
    fontWeight: "600",
  },
  inputContainer: {
    marginBottom: 8, // Reduced from 15
  },
  inputLabel: {
    fontSize: 14, // Reduced from 16
    fontWeight: "600",
    color: "#FF8F00",
    marginBottom: 6, // Reduced from 8
  },
  textInputContainer: {
    borderWidth: 1.5,
    borderColor: "#FFB74D",
    borderRadius: 8, // Reduced from 10
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12, // Reduced from 15
    elevation: 1,
  },
  input: {
    height: 42, // Reduced from 50
    fontSize: 15, // Reduced from 16
    color: "#333",
  },
  submitButton: {
    height: 44, // Reduced from 50
    borderRadius: 10, // Reduced from 12
    overflow: "hidden",
    marginTop: 5, // Reduced from 20
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
    borderRadius: 10, // Reduced from 12
  },
  submitIcon: {
    marginRight: 6, // Reduced from 8
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 15, // Reduced from 16
    fontWeight: "600",
  },
  errorText: {
    color: "#f44336",
    fontSize: 11, // Reduced from 12
    marginTop: 4, // Reduced from 5
  },
  inputError: {
    borderColor: "#f44336",
  },
})

export default OdometerReading
