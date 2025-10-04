import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  ActivityIndicator, 
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  
} from "react-native";
import axios from "react-native-axios";
import { Button, Card, Divider } from "react-native-paper";
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Footer from "./footer/Footer";
import LinearGradient from 'react-native-linear-gradient';

const Profile = ({navigation}) => {
  const [driverData, setDriverData] = useState(null);
  const [cabData, setCabData] = useState([]);  // if you want to store multiple cabs
  const [loading, setLoading] = useState(false);
  
  // Get the height of the footer to calculate proper padding
  const [footerHeight, setFooterHeight] = useState(20); // Default estimated height

  useEffect(() => {
    fetchAssignedCab();
  }, []);

  const fetchAssignedCab = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      const userId = await AsyncStorage.getItem("userid");
  
      if (token) {
        const response = await axios.get("https://api.routebudget.com/api/cabDetails/driver", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
         console.log("Response from",response.data)
        const driverDetail = response.data["Driver Detail"];  // New
        const cabAdmin = response.data["Cab Admin"];          // New
  
        setDriverData(driverDetail); // 👈 Set driver detail to your state
        setCabData(cabAdmin);         // 👈 Also you may want to save cabs separately
      }
    } catch (error) {
      console.log("Error fetching driver cab details", error);
      // Optionally show alert
      // Alert.alert("Error", "Failed to fetch assigned cab data");
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogout = () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              // Clear all stored data
              await AsyncStorage.multiRemove(['userToken', 'userid']);
              
              // Navigate to login screen or reset navigation stack
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }], // Replace 'Login' with your actual login screen name
              });
            } catch (error) {
              console.log("Error during logout:", error);
              Alert.alert("Error", "Failed to logout. Please try again.");
            }
          }
        }
      ]
    );
  };

  // Function to measure footer height
  const onFooterLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    setFooterHeight(height/3);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFC107" />
        <Text style={styles.loadingText}>Loading driver profile...</Text>
      </View>
    );
  }

  // if (!driverData) {
  //   return (
  //     <View style={styles.errorContainer}>
  //        <StatusBar barStyle="dark-content" backgroundColor="#FFFDE7" />
         
      
  //       <Text style={styles.errorText}>Loading ...</Text>
      
  //     </View>
  //   );
  // }

  const profileImage = driverData?.profileImage || "https://via.placeholder.com/100";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFDE7" />
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[
          styles.scrollViewContent,
          { paddingBottom: footerHeight + 40 } // Add extra padding (40dp) to create gap
        ]}
      >
        <View style={styles.header}>
          <View style={styles.coverPhoto}>
            <TouchableOpacity style={styles.backButton} onPress={()=>navigation.navigate("Home")}>
              <Icon name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.profileImageContainer}>
            <Image 
              source={{ uri: profileImage }} 
              style={styles.profileImage} 
            />
          </View>
          
          <Text style={styles.driverName}>{driverData?.name || "Driver Name"}</Text>
          <Text style={styles.driverRole}>Professional Driver</Text>
          
          <TouchableOpacity style={styles.editButton} onPress={()=>navigation.navigate("EditProfile")}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Card style={styles.card} elevation={3}>
            <Card.Content>
              <View style={styles.sectionTitleContainer}>
                <Icon name="person" size={22} color="#FFB300" />
                <Text style={styles.sectionTitle}>Personal Information</Text>
              </View>
              <Divider style={styles.divider} />
              
              <View style={styles.infoItem}>
                <Icon name="email" size={20} color="#FFB300" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{driverData?.email || "Not provided"}</Text>
                </View>
              </View>
              
              <View style={styles.infoItem}>
                <Icon name="phone" size={20} color="#FFB300" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{driverData?.phone || "Not provided"}</Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          <Card style={styles.card} elevation={3}>
            <Card.Content>
              <View style={styles.sectionTitleContainer}>
                <Icon name="badge" size={22} color="#FFB300" />
                <Text style={styles.sectionTitle}>Documents</Text>
              </View>
              <Divider style={styles.divider} />
              
              <View style={styles.infoItem}>
                <MaterialCommunityIcons name="license" size={20} color="#FFB300" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>License Number</Text>
                  <Text style={styles.infoValue}>{driverData?.licenseNo || "Not provided"}</Text>
                </View>
              </View>
              
              <View style={styles.infoItem}>
                <MaterialCommunityIcons name="card-account-details" size={20} color="#FFB300" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Aadhaar Number</Text>
                  <Text style={styles.infoValue}>{driverData?.adharNo || "Not provided"}</Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Logout Card */}
          <Card style={styles.card} elevation={3}>
            <Card.Content>
              <View style={styles.sectionTitleContainer}>
                <Icon name="settings" size={22} color="#FFB300" />
                <Text style={styles.sectionTitle}>Account Settings</Text>
              </View>
              <Divider style={styles.divider} />
              
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Icon name="logout" size={20} color="#E53E3E" />
                <Text style={styles.logoutButtonText}>Logout</Text>
                <Icon name="chevron-right" size={20} color="#E53E3E" />
              </TouchableOpacity>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
      
      {/* Sticky Footer */}
      <View 
        style={styles.footerWrapper}
        onLayout={onFooterLayout}
      >
         <LinearGradient 
              colors={['#f4f4f2ff', '#f1eee2ff']} 
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 0 }} 
              style={styles.footerContainer}
            >
          <Footer />
        </LinearGradient>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    // We'll dynamically add padding based on footer height
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#FFC107" // Amber color
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    marginTop: 10,
    marginBottom: 20,
    color: "#333"
  },
  retryButton: {
    backgroundColor: "#FFC107",
    paddingHorizontal: 20
  },
  header: {
    alignItems: "center",
    marginBottom: 20
  },
  coverPhoto: {
    backgroundColor: "#ffc46dff", // Light yellow
    height: 150,
    width: "100%",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  backButton: {
    margin: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.8)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  profileImageContainer: {
    position: "relative",
    marginTop: -60,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#FFF",
    backgroundColor: "#f0f0f0",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  driverName: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 10,
    color: "#333"
  },
  driverRole: {
    fontSize: 16,
    marginBottom: 15,
    fontWeight: "500"
  },
  editButton: {
    backgroundColor: "#FFC107", // Yellow
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 25,
    marginTop: 5,
    shadowColor: '#FFB300',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  editButtonText: {
    color: "#333",
    fontWeight: "bold",
    fontSize: 16
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    marginBottom: 16,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#FFFFFF", // Pure white for cards
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#FFFFFF", // Light yellow border
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 5
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
    color: "#333"
  },
  divider: {
    marginBottom: 15,
    height: 2, // Light yellow divider
  },
  infoItem: {
    flexDirection: "row",
    marginBottom: 15,
    alignItems: "flex-start",
    paddingVertical: 5
  },
  infoContent: {
    marginLeft: 15,
    flex: 1,
  },
  infoLabel: {
    fontSize: 14, // Amber color
    fontWeight: "500"
  },
  infoValue: {
    fontSize: 16,
    color: "#333",
    marginTop: 2,
    fontWeight: "400"
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#FFF5F5", // Light red background
    borderWidth: 1,
    borderColor: "#FED7D7", // Light red border
  },
  logoutButtonText: {
    fontSize: 16,
    color: "#E53E3E", // Red color
    fontWeight: "600",
    marginLeft: 12,
    flex: 1,
  },
  footerWrapper: {
    width: '100%',
    position: 'absolute',
    bottom: 0,
  },
  footerContainer: {
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 12,
    borderTopWidth: 1,
    borderTopColor: "#FFFFFF",
  }
});

export default Profile;