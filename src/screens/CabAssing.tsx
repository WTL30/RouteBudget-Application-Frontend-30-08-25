import { StyleSheet, Text, View, ToastAndroid, Alert, Platform, Dimensions, ScrollView, Modal, FlatList, TouchableOpacity } from 'react-native'
import React, { useEffect, useState, useRef } from 'react'
import LinearGradient from 'react-native-linear-gradient';
import Footer from './footer/Footer';
import axios from "react-native-axios"
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from "@react-native-picker/picker";
import { ActivityIndicator } from 'react-native';

const CabAssign = () => {
  const [footerHeight, setFooterHeight] = useState(20);
  const [cars, setCars] = useState([]);
  const [selectedCabNumber, setSelectedCabNumber] = useState('');
  const [selectedCabDetails, setSelectedCabDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const pickerRef = useRef();

  const onFooterLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    setFooterHeight(height / 3);
  };

  const showToast = (message) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('', message);
    }
  };

  const getDriverData = async () => { 
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      console.log("assign token",token)
      if (!token) {
        setMessage({ type: 'error', text: 'Authentication failed. Please login again.' });
        setLoading(false);
        return;
      }
  
      // Updated API endpoint for free cabs
      const res = await axios.get("https://api.routebudget.com/api/assigncab/driver/free-cabs", {
        headers: { Authorization: `Bearer ${token}` }
      }); 
      console.log("res",res)

      // Handle the new response structure - extract freeCabs array
      const cabList = res.data.freeCabs || []; // Get freeCabs array from response
      setCars(cabList);
      console.log("✅ Free Cabs Data:", cabList);
      
      if (cabList.length === 0) {
        setMessage({ type: 'error', text: 'No free cabs available at the moment.' });
      } else {
        setMessage({ type: '', text: '' }); // Clear any previous messages
      }
      
      setLoading(false);
    } catch (error) {
      setLoading(false);
      setMessage({ type: 'error', text: 'Failed to fetch available cabs. Please try again.' });
      console.log("❌ Error fetching free cabs data:", error.response?.data || error.message);
    }
  };

  useEffect(() => {
    getDriverData();
  }, []);

  const handleCabSelection = async (cabNumber) => {
    setSelectedCabNumber(cabNumber);
    setShowCustomPicker(false);
  
    // Find the selected cab object
    const cabDetails = cars.find(cab => cab.cabNumber === cabNumber);
  
    if (cabDetails) {
      setSelectedCabDetails(cabDetails);
      console.log("Selected Cab Details:", cabDetails);
    } else {
      setSelectedCabDetails(null);
    }
  };

  // const assignCab = async () => {
  //   if (!selectedCabDetails) {
  //     setMessage({ type: 'error', text: 'Please select a cab first' });
  //     return;
  //   }

  //   setIsSubmitting(true);
  //   setMessage({ type: '', text: '' });
  
  //   try {
  //     const token = await AsyncStorage.getItem("userToken");
  
  //     if (!token) {
  //       setMessage({ type: 'error', text: 'Authentication failed. Please login again.' });
  //       setIsSubmitting(false);
  //       return;
  //     }
  
  //     const res = await axios.post(
  //       "https://api.routebudget.com/api/assigncab/driver/cabassign",
  //       {
  //         cabNumber: selectedCabDetails.cabNumber,
  //         assignedBy: selectedCabDetails.addedBy
  //       },
  //       {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //           "Content-Type": "application/json"
  //         }
  //       }
  //     );
  
  //     console.log("✅ Cab assigned successfully:", res.data);
  //     setMessage({ type: 'success', text: `Cab ${selectedCabDetails.cabNumber} assigned successfully!` });
  //     showToast(`Cab ${selectedCabDetails.cabNumber} assigned successfully!`);
      
  //     // Refresh the free cabs list after successful assignment
  //     await getDriverData();
      
  //     // Reset selections
  //     setSelectedCabNumber('');
  //     setSelectedCabDetails(null);
      
  //   } catch (error) {
  //     console.log("❌ Error assigning cab:", error.response?.data || error.message);
  //     setMessage({ 
  //       type: 'error', 
  //       text: error.response?.data?.message || 'Failed to assign cab. Please try again.' 
  //     });
  //   } finally {
  //     setIsSubmitting(false);
  //   }
  // };
  
  const assignCab = async () => {
  if (!selectedCabDetails) {
    setMessage({ type: 'error', text: 'Please select a cab first' });
    return;
  }

  setIsSubmitting(true);
  setMessage({ type: '', text: '' });

  try {
    const token = await AsyncStorage.getItem("userToken");

    if (!token) {
      setMessage({ type: 'error', text: 'Authentication failed. Please login again.' });
      setIsSubmitting(false);
      return;
    }

    const res = await axios.post(
      "https://api.routebudget.com/api/assigncab/driver/cabassign",
      {
        cabNumber: selectedCabDetails.cabNumber,
        assignedBy: selectedCabDetails.addedBy  // This should be the admin/manager ID who added the cab
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Cab assigned successfully:", res.data);
    
    // Handle PostgreSQL response structure
    if (res.data.message === 'Cab assigned successfully' && res.data.assignment) {
      setMessage({ type: 'success', text: `Cab ${selectedCabDetails.cabNumber} assigned successfully!` });
      showToast(`Cab ${selectedCabDetails.cabNumber} assigned successfully!`);
      
      // Refresh the free cabs list after successful assignment
      await getDriverData();
      
      // Reset selections
      setSelectedCabNumber('');
      setSelectedCabDetails(null);
    } else {
      throw new Error('Unexpected response format');
    }
    
  } catch (error) {
    console.log("❌ Error assigning cab:", error.response?.data || error.message);
    
    // Handle specific PostgreSQL error messages
    let errorMessage = 'Failed to assign cab. Please try again.';
    
    if (error.response?.data?.message) {
      const serverMessage = error.response.data.message;
      
      // Handle common PostgreSQL constraint errors
      if (serverMessage.includes('already has an active cab assigned')) {
        errorMessage = 'You already have an active cab assigned. Please complete or end your current assignment first.';
      } else if (serverMessage.includes('already assigned to another driver')) {
        errorMessage = 'This cab is already assigned to another driver. Please refresh and select a different cab.';
      } else if (serverMessage.includes('Cab not found')) {
        errorMessage = 'Selected cab not found. Please refresh the cab list.';
      } else {
        errorMessage = serverMessage;
      }
    }
    
    setMessage({ type: 'error', text: errorMessage });
  } finally {
    setIsSubmitting(false);
  }
};
  
  

  const renderCabItem = ({ item, index }) => (
    <TouchableOpacity 
      style={[
        styles.cabItem, 
        index % 2 === 0 ? styles.cabItemEven : styles.cabItemOdd,
        selectedCabNumber === item.cabNumber && styles.cabItemSelected
      ]}
      onPress={() => handleCabSelection(item.cabNumber)}
    >
      <Text style={[
        styles.cabItemText,
        selectedCabNumber === item.cabNumber && styles.cabItemTextSelected
      ]}>
        {item.cabNumber}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Main content */}
      <LinearGradient
        colors={['#f3f4f6', '#e5e7eb']}
        style={styles.content}
      >
        <Text style={styles.heading}>Select Free Cab to Assign</Text>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffc46dff" />
            <Text style={styles.loadingText}>Loading free cabs...</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {cars.length === 0 && !loading ? (
              <View style={styles.noCabsContainer}>
                <Text style={styles.noCabsText}>No free cabs available</Text>
                <TouchableOpacity 
                  style={styles.refreshButton}
                  onPress={getDriverData}
                >
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Custom Picker */}
                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerTitle}>Select Free Cab Number</Text>

                  <TouchableOpacity 
                    style={styles.pickerSelector}
                    onPress={() => setShowCustomPicker(true)}
                  >
                    <Text style={selectedCabNumber ? styles.pickerSelectedText : styles.pickerPlaceholderText}>
                      {selectedCabNumber || 'Select Free Cab Number'}
                    </Text>
                    <View style={styles.dropdownIcon}>
                      <Text style={styles.dropdownIconText}>▼</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Fallback for iOS */}
                  {Platform.OS === 'ios' && (
                    <View style={styles.iOSPickerWrapper}>
                      <Picker
                        ref={pickerRef}
                        selectedValue={selectedCabNumber}
                        onValueChange={handleCabSelection}
                        style={styles.iOSPicker}
                      >
                        <Picker.Item label="Select Free Cab Number" value="" />
                        {cars.map((cab, index) => (
                          <Picker.Item 
                            key={index} 
                            label={cab.cabNumber} 
                            value={cab.cabNumber} 
                          />
                        ))}
                      </Picker>
                    </View>
                  )}
                </View>

                {selectedCabDetails && (
                  <View style={styles.detailsCard}>
                    <Text style={styles.detailsTitle}>Selected Cab Details</Text>
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsLabel}>Cab Number:</Text>
                      <Text style={styles.detailsValue}>{selectedCabDetails.cabNumber}</Text>
                    </View>
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsLabel}>Registration:</Text>
                      <Text style={styles.detailsValue}>{selectedCabDetails.registrationNumber}</Text>
                    </View>
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsLabel}>Insurance Number:</Text>
                      <Text style={styles.detailsValue}>{selectedCabDetails.insuranceNumber}</Text>
                    </View>
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsLabel}>Insurance Expiry:</Text>
                      <Text style={styles.detailsValue}>
                        {new Date(selectedCabDetails.insuranceExpiry).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsLabel}>Added By:</Text>
                      <Text style={styles.detailsValue}>{selectedCabDetails.addedBy}</Text>
                    </View>

                    <TouchableOpacity
                      onPress={assignCab}
                      disabled={isSubmitting}
                      style={[styles.assignButton, isSubmitting && styles.assignButtonDisabled]}
                    >
                      <LinearGradient
                        colors={isSubmitting ? ['#9ca3af', '#9ca3af'] : ['#ffc46dff', '#ffc46dff']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.assignButtonGradient}
                      >
                        <Text style={styles.buttonText}>
                          {isSubmitting ? 'Assigning...' : 'Assign Cab'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {message.text ? (
              <View style={[
                styles.messageContainer, 
                message.type === 'success' ? styles.successMessage : styles.errorMessage
              ]}>
                <Text style={styles.messageText}>{message.text}</Text>
              </View>
            ) : null}
          </ScrollView>
        )}
      </LinearGradient>

      {/* Custom Picker Modal */}
      <Modal
        visible={showCustomPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCustomPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCustomPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderText}>Select Free Cab Number</Text>
            </View>
            <FlatList
              data={cars}
              renderItem={renderCabItem}
              keyExtractor={(item, index) => index.toString()}
              style={styles.cabList}
              contentContainerStyle={styles.cabListContent}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Footer at the bottom */}
      <View style={styles.footerWrapper} onLayout={onFooterLayout}>
          <Footer />
      </View>
    </View>
  );
};

export default CabAssign;

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: '#f2f2f2'
  },
  content: {
    flex: 1,
    padding: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffc46dff',
    marginBottom: 24,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#ffc46dff',
    fontSize: 16,
  },
  noCabsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noCabsText: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: '#ffc46dff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    marginBottom: 20,
    overflow: 'hidden',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffc46dff',
    textAlign: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 4,
  },
  pickerPlaceholderText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  pickerSelectedText: {
    color: '#ffc46dff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dropdownIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownIconText: {
    color: '#ffc46dff',
    fontSize: 12,
  },
  iOSPickerWrapper: {
    display: 'none', // Hide this on iOS, but keep it for functionality
  },
  // Custom modal picker styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.8,
    maxHeight: height * 0.7,
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalHeader: {
    backgroundColor: '#f9fafb',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffc46dff',
    textAlign: 'center',
  },
  cabList: {
    maxHeight: height * 0.6,
  },
  cabListContent: {
    flexGrow: 1,
  },
  cabItem: {
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cabItemEven: {
    backgroundColor: '#ffffff',
  },
  cabItemOdd: {
    backgroundColor: '#f9fafb',
  },
  cabItemSelected: {
    backgroundColor: '#e6f7ff',
  },
  cabItemText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#374151',
  },
  cabItemTextSelected: {
    color: '#00529B',
  },
  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffc46dff',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 8,
    textAlign: 'center',
  },
  detailsRow: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingVertical: 4,
    justifyContent: 'center',
  },
  detailsLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4b5563',
    width: '40%',
    textAlign: 'right',
    paddingRight: 10,
  },
  detailsValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1f2937',
    width: '60%',
  },
  assignButton: {
    borderRadius: 6,
    marginTop: 16,
    overflow: 'hidden',
  },
  assignButtonDisabled: {
    opacity: 0.7,
  },
  assignButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  messageContainer: {
    padding: 12,
    borderRadius: 6,
    marginTop: 10,
  },
  successMessage: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
    borderWidth: 1,
  },
  errorMessage: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  messageText: {
    fontSize: 14,
    color: '#1f2937',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  footerWrapper: {
    width: '100%',
  },
  footerContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 10,
  }
});