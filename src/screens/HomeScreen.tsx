"use client";

import type React from "react";
import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Image,
  Dimensions,
  Alert,
  type FlatList,
  RefreshControl,
  Modal,
  Linking,
  Pressable,
  TextInput,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "react-native-axios";
import { CommonActions } from "@react-navigation/native";
import Footer from "./footer/Footer";
import { startAutoTracking, stopAutoTracking } from "../services/AutoDriverTracking";
import FastTagPaymentScreen from "./FastTagPaymentScreen";
import FuelPaymentScreen from "./FuelPaymentScreen";
import TyrePunctureScreen from "./TyrePunctureScreen";
import ReportProblemScreen from "./ReportProblemScreen";
import VehicleServiceScreen from "./VehicleServiceScreen";
import LocationScreen from "./LocationScreen";
import OdometerReading from "./OdometerReading";
import CustomerDetailScreen from "./CustomerDetailScreen";
import TripInfoScreen from "./TripInfoScreen";

const { width, height } = Dimensions.get("window");

interface CabDetails {
  cabNumber: string;
  cabImage?: string;
}

interface Driver {
  name: string;
}

interface Admin {
  name: string;
  phone: string;
  email: string;
}

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  screen: string;
  description: string;
}

interface TripInfoData {
  customerName: string | null;
  customerPhone: string | null;
  pickupLocation: string | null;
  dropLocation: string | null;
  tripType: string | null;
  vehicleType: string | null;
  duration: string | null;
  estimatedDistance: string | null;
  estimatedFare: number | null;
  actualFare: number | null;
  scheduledPickupTime: string | null;
  actualPickupTime: string | null;
  dropTime: string | null;
  specialInstructions: string | null;
  adminNotes: string | null;
  rideId?: string | null;
}

const ExpenseTracker: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const navigation = useNavigation();
  const [cabDetails, setCabDetails] = useState<CabDetails | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [assignedCabId, setAssignedCabId] = useState<string>("");
  const flatListRef = useRef<FlatList>(null);
  const [showImageCarousel, setShowImageCarousel] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [scrollPosition, setScrollPosition] = useState<number>(0);
  const [contentWidth, setContentWidth] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [tripInfoVisible, setTripInfoVisible] = useState(false);
  const [tripInfoData, setTripInfoData] = useState<TripInfoData | null>(null);
  const unauthorizedHandledRef = useRef(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [activeComponent, setActiveComponent] = useState<string | null>(null);
  const [completeModalVisible, setCompleteModalVisible] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [cashAmount, setCashAmount] = useState<string>("");

  const carImages = [
    require("../assets/cabexpensetwo.jpeg"),
    require("../assets/cabexpensethree.jpg"),
    require("../assets/cabexpensefour.jpg"),
  ];

  const categories: Category[] = [
    {
      id: 1,
      name: "Location",
      icon: "map-marker",
      color: "#FFE5E5",
      screen: "Location",
      description: "Track routes",
    },
    {
      id: 2,
      name: "Odometer",
      icon: "speedometer",
      color: "#E5F9F6",
      screen: "Odometer",
      description: "Monitor distance",
    },
    {
      id: 3,
      name: "Fuel",
      icon: "gas-station",
      color: "#E5F3FF",
      screen: "FuelStatus",
      description: "Log expenses",
    },
    {
      id: 4,
      name: "Service",
      icon: "wrench",
      color: "#F0E5FF",
      screen: "VehicleService",
      description: "Record costs",
    },
    {
      id: 5,
      name: "Fast Tag",
      icon: "credit-card",
      color: "#F0E5FF",
      screen: "FastTag",
      description: "Manage tolls",
    },
    {
      id: 6,
      name: "Tyre",
      icon: "tire",
      color: "#FFE5D6",
      screen: "TyrePuncture",
      description: "Report issues",
    },
    {
      id: 7,
      name: "Issues",
      icon: "alert-circle",
      color: "#FFF5E5",
      screen: "ReportProblem",
      description: "Report problems",
    },
    {
      id: 8,
      name: "Customer",
      icon: "chat",
      color: "#a5aaaeff",
      screen: "Customer",
      description: "Customer Details",
    },
  ];

  const getIconColor = (categoryId: number) => {
    const iconColors = {
      1: "#FF4444", // Location - Red
      2: "#00CC88", // Odometer - Green
      3: "#0088FF", // Fuel - Blue
      4: "#8844FF", // Service - Purple
      5: "#8844FF", // Fast Tag - Purple
      6: "#FF6600", // Tyre - Orange
      7: "#FF8800", // Issues - Yellow/Orange
      8: "#0088FF", // Chat - Blue
      9: "#FFA726", // Cab Number - Orange
    };
    return iconColors[categoryId] || "#666666";
  };

  const redirectToLogin = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Login" as never }],
      }),
    );
  };

  const clearSession = async () => {
    try {
      await AsyncStorage.multiRemove([
        "userToken",
        "userid",
        "savedLocationData",
        "lastKnownPosition",
      ]);
    } catch (storageError) {
      console.log("Error clearing session:", storageError);
    }
  };

  const handleUnauthorizedAccess = async () => {
    if (unauthorizedHandledRef.current) return;
    unauthorizedHandledRef.current = true;
    await clearSession();

    Alert.alert("Session Expired", "Your session has expired. Please log in again.", [
      {
        text: "OK",
        onPress: redirectToLogin,
      },
    ]);
  };

  const handleCategoryPress = (screen: string) => {
    if (screen === "Chat") {
      Alert.alert("Chat", "Chat feature will be available soon!");
      return;
    }
    setActiveComponent(screen);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setActiveComponent(null);
  };

  const renderModalComponent = () => {
    const commonProps = { onClose: closeModal };
    switch (activeComponent) {
      case "Location":
        return <LocationScreen {...commonProps} />;
      case "Odometer":
        return <OdometerReading {...commonProps} />;
      case "FuelStatus":
        return <FuelPaymentScreen {...commonProps} />;
      case "VehicleService":
        return <VehicleServiceScreen {...commonProps} />;
      case "FastTag":
        return <FastTagPaymentScreen {...commonProps} />;
      case "TyrePuncture":
        return <TyrePunctureScreen {...commonProps} />;
      case "ReportProblem":
        return <ReportProblemScreen {...commonProps} />;
      case "Customer":
        return <CustomerDetailScreen {...commonProps} />;
      default:
        return (
          <View style={styles.defaultModalContent}>
            <Text style={styles.defaultModalText}>Component not found</Text>
          </View>
        );
    }
  };

  useEffect(() => {
    if (!showImageCarousel) return;
    const slideInterval = setInterval(() => {
      if (flatListRef.current) {
        const nextIndex = (currentImageIndex + 1) % carImages.length;
        flatListRef.current.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        setCurrentImageIndex(nextIndex);
      }
    }, 4000);
    return () => clearInterval(slideInterval);
  }, [currentImageIndex, showImageCarousel]);

  useEffect(() => {
    fetchAssignedCab();
  }, []);

  // Start background auto-tracking as soon as app (Home) is visible
  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        await startAutoTracking();
      } catch {}
    })();
    return () => {
      if (!stopped) {
        stopAutoTracking();
        stopped = true;
      }
    };
  }, []);

  const fetchAssignedCab = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        await handleUnauthorizedAccess();
        return;
      }

      const response = await axios.get("http://192.168.1.25:5000/api/assignCab/driver", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("API Response:", response.data);

      const assignments = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.assignment)
          ? response.data.assignment
          : [];

      if (assignments.length > 0) {
        const assignedCab = assignments[0];

        const driverInfo = assignedCab?.Driver
          ? { name: assignedCab.Driver.name }
          : null;

        const cabInfo = assignedCab?.CabsDetail
          ? {
              cabNumber: assignedCab.CabsDetail.cabNumber,
              cabImage: assignedCab.CabsDetail.cabImage,
            }
          : null;

        const adminInfo = assignedCab?.Admin
          ? {
              name: assignedCab.Admin.name,
              phone: assignedCab.Admin.phone,
              email: assignedCab.Admin.email,
            }
          : null;

        const tripInfo: TripInfoData = {
          customerName: assignedCab?.customerName ?? null,
          customerPhone: assignedCab?.customerPhone ?? null,
          pickupLocation: assignedCab?.pickupLocation ?? assignedCab?.locationFrom ?? null,
          dropLocation: assignedCab?.dropLocation ?? assignedCab?.locationTo ?? null,
          tripType: assignedCab?.tripType ?? null,
          vehicleType: assignedCab?.vehicleType ?? null,
          duration: assignedCab?.duration ? String(assignedCab.duration) : null,
          estimatedDistance: assignedCab?.estimatedDistance
            ? String(assignedCab.estimatedDistance)
            : null,
          estimatedFare: assignedCab?.estimatedFare ?? null,
          actualFare: assignedCab?.actualFare ?? null,
          scheduledPickupTime: assignedCab?.scheduledPickupTime ?? null,
          actualPickupTime: assignedCab?.actualPickupTime ?? null,
          dropTime: assignedCab?.dropTime ?? null,
          specialInstructions: assignedCab?.specialInstructions ?? null,
          adminNotes: assignedCab?.adminNotes ?? null,
          rideId: assignedCab?.rideId ?? assignedCab?.id?.toString?.() ?? null,
        };

        setDriver(driverInfo);
        setCabDetails(cabInfo);
        setAdmin(adminInfo);
        setAssignedCabId(assignedCab.id.toString());
        setTripInfoData(tripInfo);
        setShowImageCarousel(true);
      } else {
        setDriver(null);
        setCabDetails(null);
        setAdmin(null);
        setAssignedCabId("");
        setShowImageCarousel(false);
        setTripInfoData(null);
      }
    } catch (error: any) {
      console.log("Error fetching cab details:", error);
      const status = error?.response?.status;
      if (status === 401) {
        await handleUnauthorizedAccess();
      } else if (status === 404) {
        setDriver(null);
        setCabDetails(null);
        setAdmin(null);
        setAssignedCabId("");
        setShowImageCarousel(false);
        setTripInfoData(null);
      } else {
        Alert.alert("Error", "Failed to fetch cab details. Please try again later.");
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAssignedCab();
    } catch (error) {
      console.log("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSOS = async () => {
    if (!admin || !admin.phone) {
      Alert.alert(
        "SOS Unavailable",
        "Admin contact information is not available. Please try refreshing or contact support.",
        [
          { text: "Refresh", onPress: onRefresh },
          { text: "Cancel", style: "cancel" },
        ],
      );
      return;
    }

    Alert.alert(
      "Emergency SOS",
      `Do you want to call the admin (${admin.name}) for emergency assistance?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call Now",
          style: "destructive",
          onPress: () => makeEmergencyCall(admin.phone),
        },
      ],
    );
  };

  const makeEmergencyCall = async (phoneNumber: string) => {
    try {
      const phoneUrl = `tel:${phoneNumber}`;
      const supported = await Linking.canOpenURL(phoneUrl);

      if (supported) {
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert(
          "Call Failed",
          "Unable to make phone call. Please dial manually: " + phoneNumber,
          [
            {
              text: "Copy Number",
              onPress: () => {
                Alert.alert("Number to Call", phoneNumber);
              },
            },
            { text: "OK" },
          ],
        );
      }
    } catch (error) {
      console.log("Error making phone call:", error);
      Alert.alert("Call Error", "Failed to initiate call. Please dial manually: " + phoneNumber);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        onPress: async () => {
          await AsyncStorage.removeItem("userToken");
          await AsyncStorage.removeItem("userid");
          await AsyncStorage.removeItem("savedLocationData");
          await AsyncStorage.removeItem("lastKnownPosition");
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "Login" }],
            }),
          );
        },
      },
    ]);
  };

  const resetCompletionState = () => {
    setPaymentMethod("cash");
    setCashAmount("");
  };

  const handleTripComplete = () => {
    if (!cabDetails) {
      Alert.alert("No Active Trip", "There is no active trip to complete.");
      return;
    }

    resetCompletionState();
    setCompleteModalVisible(true);
  };

  const completeTrip = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        await handleUnauthorizedAccess();
        return;
      }

      if (!assignedCabId) {
        Alert.alert("No Active Trip", "There is no active trip to complete.");
        return;
      }

      if (paymentMethod === "cash" && (!cashAmount || Number.isNaN(Number(cashAmount)))) {
        Alert.alert("Invalid Amount", "Please enter a valid cash amount.");
        return;
      }

      await axios.put(
        `http://192.168.1.25:5000/api/assigncab/complete/${assignedCabId}`,
        {
          paymentMode: paymentMethod,
          cashReceived: paymentMethod === "cash" ? Number(cashAmount) : 0,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setCabDetails(null);
      setDriver(null);
      setAdmin(null);
      setAssignedCabId("");
      setShowImageCarousel(false);
      setTripInfoData(null);
      Alert.alert("Success", "Trip completed successfully!");
      await AsyncStorage.removeItem("savedLocationData");
      resetCompletionState();
      setCompleteModalVisible(false);
    } catch (error: any) {
      console.log("Error completing trip:", error);
      const status = error?.response?.status;
      if (status === 401) {
        await handleUnauthorizedAccess();
        return;
      }
      Alert.alert("Error", "Failed to complete trip. Please try again.");
    }
  };

  const renderCategoryCard = (category: Category) => (
    <TouchableOpacity
      key={category.id}
      style={styles.categoryCard}
      onPress={() => handleCategoryPress(category.screen)}
      activeOpacity={0.8}
    >
      <View style={[styles.categoryIconContainer, { backgroundColor: category.color }]}>
        <Icon name={category.icon} size={24} color={getIconColor(category.id)} />
      </View>
      <Text style={styles.categoryName}>{category.name}</Text>
      <Text style={styles.categoryDescription}>{category.description}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#ffca7cff" />

      {/* Header */}
      <LinearGradient colors={["#ffc46dff", "#ffca7cff"]} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <View style={styles.logoBackground}>
                <Text style={styles.logoText}>R</Text>
              </View>
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Route Budget</Text>
              <Text style={styles.headerSubtitle}>Smart Trip Management</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.sosButton, !admin?.phone && styles.sosButtonDisabled]}
              activeOpacity={0.8}
              onPress={handleSOS}
              disabled={!admin?.phone}
            >
              <Icon name="phone" size={14} color="#ffffff" style={styles.sosIcon} />
              <Text style={styles.sosText}>SOS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navigation.navigate("Profile" as never)}
              activeOpacity={0.8}
            >
              <Icon name="account" size={20} color="#FFA726" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.mainContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#FFA726"]}
            tintColor="#FFA726"
            title="Refreshing..."
            titleColor="#FFA726"
          />
        }
      >
        {/* Admin Contact Info Display */}
        {admin && (
          <View style={styles.adminInfoContainer}>
            <Text style={styles.adminInfoText}>
              Emergency Contact: {admin.name} ({admin.phone})
            </Text>
          </View>
        )}

        {/* Quick Actions Section */}
        <View style={[styles.quickActionsSection, tripInfoData && styles.quickActionsCompact]}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Text style={styles.sectionSubtitle}>Manage your trip expenses efficiently</Text>
          <View style={styles.categoriesGrid}>{categories.map((category) => renderCategoryCard(category))}</View>
        </View>

        {/* Other Details Button */}
        {tripInfoData && (
          <View style={styles.tripInfoButtonWrapper}>
            <TouchableOpacity
              style={styles.tripInfoButton}
              onPress={() => setTripInfoVisible(true)}
              activeOpacity={0.85}
            >
              <Icon name="information-outline" size={18} color="#ffffff" />
              <Text style={styles.tripInfoButtonText}>Other Details</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Your Ride Section */}
        <View style={styles.cabSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Your Ride</Text>
              <Text style={styles.sectionSubtitle}>Current vehicle assignment</Text>
            </View>
            {cabDetails && (
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Active</Text>
              </View>
            )}
          </View>

          {cabDetails && driver ? (
            <View style={styles.cabCard}>
              <LinearGradient colors={["#ffffff", "#f8fafc"]} style={styles.cabCardGradient}>
                {cabDetails?.cabImage && (
                  <View style={styles.cabImageContainer}>
                    <Image source={{ uri: cabDetails.cabImage }} style={styles.cabImage} resizeMode="cover" />
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.3)"]} style={styles.imageOverlay} />
                    <View style={styles.vehicleNumberBadge}>
                      <Text style={styles.vehicleNumberText}>{cabDetails?.cabNumber}</Text>
                    </View>
                  </View>
                )}
                <View style={styles.cabDetailsContainer}>
                  <View style={styles.cabDetailsHeader}>
                    <View style={styles.vehicleTypeContainer}>
                      <Icon name="car" size={20} color="#FFA726" />
                      <Text style={styles.vehicleTypeText}>Assigned Vehicle</Text>
                    </View>
                  </View>
                  <View style={styles.cabInfoGrid}>
                    <View style={styles.infoCard}>
                      <View style={styles.infoCardHeader}>
                        <View style={[styles.infoIconContainer, { backgroundColor: "#10b981" }]}>
                          <Icon name="account" size={18} color="#ffffff" />
                        </View>
                        <Text style={styles.infoCardTitle}>Driver</Text>
                      </View>
                      <Text style={styles.infoCardValue}>{driver.name}</Text>
                    </View>
                    <View style={styles.infoCard}>
                      <View style={styles.infoCardHeader}>
                        <View style={[styles.infoIconContainer, { backgroundColor: "#3b82f6" }]}>
                          <Icon name="car-key" size={18} color="#ffffff" />
                        </View>
                        <Text style={styles.infoCardTitle}>Vehicle ID</Text>
                      </View>
                      <Text style={styles.infoCardValue}>{cabDetails?.cabNumber}</Text>
                    </View>
                  </View>
                  <View style={styles.tripStatusContainer}>
                    <View style={styles.tripStatusItem}>
                      <Icon name="clock-outline" size={16} color="#64748b" />
                      <Text style={styles.tripStatusText}>Trip in Progress</Text>
                    </View>
                    <View style={styles.tripStatusItem}>
                      <Icon name="map-marker-radius" size={16} color="#10b981" />
                      <Text style={styles.tripStatusText}>Location Tracking Active</Text>
                    </View>
                    {admin && (
                      <View style={styles.tripStatusItem}>
                        <Icon name="shield-check" size={16} color="#FFA726" />
                        <Text style={styles.tripStatusText}>Emergency Support Available</Text>
                      </View>
                    )}
                  </View>
                </View>
              </LinearGradient>
            </View>
          ) : (
            <View style={styles.noCabCard}>
              <LinearGradient colors={["#f8fafc", "#f1f5f9"]} style={styles.noCabGradient}>
                <View style={styles.noCabContent}>
                  <View style={styles.noCabIconContainer}>
                    <Icon name="car-off" size={40} color="#94a3b8" />
                  </View>
                  <Text style={styles.noCabTitle}>No Vehicle Assigned</Text>
                  <Text style={styles.noCabSubtitle}>
                    Please wait for vehicle assignment from admin. You'll be notified once a vehicle is assigned to you.
                  </Text>
                  <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                    <Icon name="refresh" size={16} color="#FFA726" />
                    <Text style={styles.refreshButtonText}>Refresh Status</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          )}
        </View>

        {/* Complete Trip Button */}
        {cabDetails && (
          <View style={styles.actionSection}>
            <TouchableOpacity style={styles.completeButton} onPress={handleTripComplete} activeOpacity={0.9}>
              <LinearGradient colors={["#FFA726", "#FF8F00"]} style={styles.completeButtonGradient}>
                <Icon name="check-circle-outline" size={22} color="#ffffff" />
                <Text style={styles.completeButtonText}>Complete Trip</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footerContainer}>
        <Footer />
      </View>

      {/* Modal for Quick Actions */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          <View
            style={[
              styles.modalContainer,
              (activeComponent === "Customer" ||
                activeComponent === "FuelStatus" ||
                activeComponent === "VehicleService") &&
                styles.customerModalContainer,
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {categories.find((cat) => cat.screen === activeComponent)?.name || "Quick Action"}
              </Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>{renderModalComponent()}</View>
          </View>
        </View>
      </Modal>

      {/* Modal for TripInfoScreen */}
      <Modal
        visible={tripInfoVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTripInfoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setTripInfoVisible(false)} />
          <View style={[styles.modalContainer, styles.customerModalContainer]}>
            <TripInfoScreen
              tripData={tripInfoData}
              onBack={() => setTripInfoVisible(false)}
            />
          </View>
        </View>
      </Modal>

      {/* Complete Trip Modal */}
      <Modal
        visible={completeModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setCompleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.completeTripModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complete Trip</Text>
              <TouchableOpacity
                onPress={() => {
                  setCompleteModalVisible(false);
                  resetCompletionState();
                }}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.paymentOptionContainer}>
              <Text style={styles.paymentLabel}>Select Payment Method</Text>
              <View style={styles.paymentOptionsRow}>
                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    styles.paymentOptionLeft,
                    paymentMethod === "cash" && styles.paymentOptionSelected,
                  ]}
                  onPress={() => setPaymentMethod("cash")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.paymentOptionIndicator, paymentMethod === "cash" && styles.paymentOptionIndicatorSelected]} />
                  <Text style={styles.paymentOptionText}>Cash</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.paymentOption, paymentMethod === "online" && styles.paymentOptionSelected]}
                  onPress={() => setPaymentMethod("online")}
                  activeOpacity={0.8}
                >
                  <View
                    style={[styles.paymentOptionIndicator, paymentMethod === "online" && styles.paymentOptionIndicatorSelected]}
                  />
                  <Text style={styles.paymentOptionText}>Online Payment</Text>
                </TouchableOpacity>
              </View>
            </View>

            {paymentMethod === "cash" && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Cash Collected (₹)</Text>
                <View style={styles.inputControl}>
                  <Text style={styles.inputPrefix}>₹</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                    value={cashAmount}
                    onChangeText={setCashAmount}
                  />
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setCompleteModalVisible(false);
                  resetCompletionState();
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalConfirmButton]} onPress={completeTrip}>
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    paddingTop: 19,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  logoContainer: {
    marginRight: 12,
  },
  logoBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFA726",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  sosButton: {
    backgroundColor: "#FF5722",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#FF5722",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sosButtonDisabled: {
    backgroundColor: "#cccccc",
    shadowOpacity: 0,
    elevation: 0,
  },
  sosIcon: {
    marginRight: 4,
  },
  sosText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 12,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  mainContent: {
    flex: 1,
  },
  adminInfoContainer: {
    backgroundColor: "#e8f5e8",
    padding: 12,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
  },
  adminInfoText: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "500",
  },
  quickActionsSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  quickActionsCompact: {
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFA726",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 20,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  categoryCard: {
    width: (width - 60) / 4,
    alignItems: "center",
    marginBottom: 20,
  },
  categoryIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: "500",
    color: "#333333",
    textAlign: "center",
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 10,
    color: "#666666",
    textAlign: "center",
    lineHeight: 12,
  },
  tripInfoButtonWrapper: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 12,
    alignItems: "center",
  },
  tripInfoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  tripInfoButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  cabSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10b981",
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#059669",
  },
  cabCard: {
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  cabCardGradient: {
    flex: 1,
  },
  cabImageContainer: {
    height: 140,
    position: "relative",
    overflow: "hidden",
  },
  cabImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  vehicleNumberBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vehicleNumberText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  cabDetailsContainer: {
    padding: 20,
  },
  cabDetailsHeader: {
    marginBottom: 16,
  },
  vehicleTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  vehicleTypeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginLeft: 8,
  },
  cabInfoGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  infoCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  infoCardTitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748b",
  },
  infoCardValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    lineHeight: 20,
  },
  tripStatusContainer: {
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 16,
  },
  tripStatusItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  tripStatusText: {
    fontSize: 13,
    color: "#475569",
    marginLeft: 8,
    fontWeight: "500",
  },
  noCabCard: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  noCabGradient: {
    padding: 32,
    alignItems: "center",
  },
  noCabContent: {
    alignItems: "center",
  },
  noCabIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  noCabTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 12,
    textAlign: "center",
  },
  noCabSubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff7ed",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#FFA726",
    marginLeft: 6,
  },
  actionSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  completeButton: {
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#FFA726",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  completeButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  completeButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  footerContainer: {
    position: "relative",
  },
  bottomSpacing: {
    height: 100,
  },
  completeTripModal: {
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    maxHeight: height * 0.85,
    minHeight: height * 0.5,
    width: "100%",
    maxWidth: 400,
  },
  customerModalContainer: {
    maxHeight: height * 0.85,
    minHeight: height * 0.85,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  paymentOptionContainer: {
    marginBottom: 16,
  },
  paymentLabel: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "600",
    marginBottom: 10,
  },
  paymentOptionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  paymentOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  paymentOptionLeft: {
    marginRight: 12,
  },
  paymentOptionSelected: {
    borderColor: "#FFA726",
    backgroundColor: "#fff7eb",
  },
  paymentOptionIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    marginRight: 10,
  },
  paymentOptionIndicatorSelected: {
    borderColor: "#FFA726",
    backgroundColor: "#FFA726",
  },
  paymentOptionText: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "600",
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "600",
    marginBottom: 8,
  },
  inputControl: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },
  inputPrefix: {
    fontSize: 16,
    color: "#94a3b8",
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#1f2937",
    paddingVertical: 10,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  modalCancelButton: {
    marginRight: 10,
    backgroundColor: "#e2e8f0",
  },
  modalConfirmButton: {
    backgroundColor: "#FFA726",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  defaultModalContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  defaultModalText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
});

export default ExpenseTracker;
