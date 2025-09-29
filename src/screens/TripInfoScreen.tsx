import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, Modal, Alert } from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

interface TripData {
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

interface TripInfoScreenProps {
  tripData: TripData | null;
  onBack: () => void;
}

const colors = {
  primary: "#92400E",
  secondary: "#FEF3C7",
  accent: "#F59E0B",
  text: "#1f2937",
  success: "#10b981",
  error: "#ef4444",
};

const TripInfoScreen: React.FC<TripInfoScreenProps> = ({ tripData, onBack }) => {
  const [detailsVisible, setDetailsVisible] = useState(false);

  const formatDateTime = (dateString: string | null): string => {
    if (!dateString) return "Not set";
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return "Invalid date";
    }
  };

  const formatCurrency = (amount: number | null): string => {
    if (amount === null || amount === undefined) return "Not set";
    return `₹${amount.toFixed(2)}`;
  };

  const handlePhonePress = (phone: string | null) => {
    if (phone) {
      const phoneUrl = `tel:${phone}`;
      Linking.canOpenURL(phoneUrl)
        .then((supported) => {
          if (supported) {
            Linking.openURL(phoneUrl);
          } else {
            Alert.alert("Error", "Phone call is not supported on this device.");
          }
        })
        .catch((err) => {
          console.log("Error opening phone:", err);
          Alert.alert("Error", "An error occurred while trying to make the call.");
        });
    } else {
      Alert.alert("Error", "No phone number provided.");
    }
  };

  if (!tripData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trip Information</Text>
        </View>
        <View style={styles.scrollContent}>
          <Text style={styles.infoValue}>No trip data available.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Information</Text>
        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => setDetailsVisible(true)}
          accessibilityLabel="View other details"
          accessibilityRole="button"
        >
          <MaterialIcons name="info" size={22} color={colors.primary} />
          <Text style={styles.headerActionText}></Text>
        </TouchableOpacity>
      </View>

      {tripData?.rideId ? (
        <View style={styles.rideIdBadgeContainer}>
          <Text style={styles.rideIdBadge}>RID: {tripData.rideId}</Text>
        </View>
      ) : (
        <View style={styles.rideIdBadgeContainer}>
          <Text style={styles.rideIdBadge}>RID: Not set</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={true}
        scrollEventThrottle={16}
      >
        {/* Quick Actions */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="flash-on" size={18} color={colors.accent} />
            <Text style={styles.cardTitle}>Quick Actions</Text>
          </View>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handlePhonePress(tripData?.customerPhone)}
              accessibilityLabel="Call customer"
              accessibilityRole="button"
            >
              <MaterialIcons name="call" size={18} color={colors.primary} />
              <Text style={styles.quickActionText}>Call Customer</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Customer Information Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="person" size={18} color={colors.accent} />
            <Text style={styles.cardTitle}>Customer Information</Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <MaterialIcons name="person-outline" size={16} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>{tripData?.customerName || "Not set"}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <MaterialIcons name="phone" size={16} color={colors.success} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Phone Number</Text>
                <TouchableOpacity
                  onPress={() => handlePhonePress(tripData?.customerPhone)}
                  accessibilityLabel={`Call ${tripData?.customerPhone || "customer"}`}
                  accessibilityRole="link"
                >
                  <Text style={[styles.infoValue, styles.phoneNumber]}>
                    {tripData?.customerPhone || "Not set"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Timing Information Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="access-time" size={18} color={colors.accent} />
            <Text style={styles.cardTitle}>Timing Information</Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <MaterialIcons name="event" size={16} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Scheduled Pickup</Text>
                <Text style={styles.infoValue}>{formatDateTime(tripData?.scheduledPickupTime)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <MaterialIcons name="play-circle-outline" size={16} color={colors.success} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Actual Pickup</Text>
                <Text style={styles.infoValue}>{formatDateTime(tripData?.actualPickupTime)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <MaterialIcons name="stop-circle" size={16} color={colors.error} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Drop Time</Text>
                <Text style={styles.infoValue}>{formatDateTime(tripData?.dropTime)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Fare Information Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="payments" size={18} color={colors.accent} />
            <Text style={styles.cardTitle}>Fare Information</Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <MaterialIcons name="calculate" size={16} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Estimated Fare</Text>
                <Text style={styles.infoValue}>{formatCurrency(tripData?.estimatedFare)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <MaterialIcons name="receipt" size={16} color={colors.success} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoValue, styles.fareAmount]}>
                  {formatCurrency(tripData?.actualFare)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Details Modal */}
      <Modal
        visible={detailsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailsVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Other Details</Text>
            <ScrollView>
              <Text style={styles.infoLabel}>Ride ID</Text>
              <Text style={styles.infoValue}>{tripData?.rideId || "Not set"}</Text>

              <Text style={styles.infoLabel}>Trip Type</Text>
              <Text style={styles.infoValue}>{tripData?.tripType || "Not set"}</Text>

              <Text style={styles.infoLabel}>Vehicle Type</Text>
              <Text style={styles.infoValue}>{tripData?.vehicleType || "Not set"}</Text>

              <Text style={styles.infoLabel}>Duration</Text>
              <Text style={styles.infoValue}>{tripData?.duration || "Not set"}</Text>

              <Text style={styles.infoLabel}>Estimated Distance</Text>
              <Text style={styles.infoValue}>{tripData?.estimatedDistance || "Not set"}</Text>

              <Text style={styles.infoLabel}>Pickup Location</Text>
              <Text style={styles.infoValue}>{tripData?.pickupLocation || "Not set"}</Text>

              <Text style={styles.infoLabel}>Drop Location</Text>
              <Text style={styles.infoValue}>{tripData?.dropLocation || "Not set"}</Text>

              <Text style={styles.infoLabel}>Special Instructions</Text>
              <Text style={styles.infoValue}>{tripData?.specialInstructions || "Not set"}</Text>

              <Text style={styles.infoLabel}>Admin Notes</Text>
              <Text style={styles.infoValue}>{tripData?.adminNotes || "Not set"}</Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setDetailsVisible(false)}
              accessibilityLabel="Close details modal"
              accessibilityRole="button"
            >
              <Text style={{ color: colors.primary, fontWeight: "700" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.secondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary,
    elevation: 4,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 10,
    borderRadius: 25,
    backgroundColor: colors.secondary,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
  },
  headerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.secondary,
  },
  headerActionText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  rideIdBadgeContainer: {
    alignItems: "center",
    backgroundColor: colors.secondary,
    paddingTop: 8,
  },
  rideIdBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.secondary,
    color: colors.primary,
    fontWeight: "700",
  },
  bottomPadding: {
    height: 80,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.secondary,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
    marginLeft: 8,
  },
  quickActionsRow: {
    flexDirection: "row",
    columnGap: 12,
  },
  quickActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  quickActionText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 13,
    marginLeft: 8,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 20,
  },
  phoneNumber: {
    color: colors.success,
    textDecorationLine: "underline",
  },
  fareAmount: {
    color: colors.success,
    fontWeight: "700",
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 12,
  },
  modalCloseButton: {
    alignSelf: "center",
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.secondary,
  },
});

export default TripInfoScreen;