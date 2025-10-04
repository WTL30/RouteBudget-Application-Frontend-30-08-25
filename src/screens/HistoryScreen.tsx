import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "react-native-axios";
import Footer from "./footer/Footer";

interface Trip {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  pickupLocation: string | null;
  dropLocation: string | null;
  tripType: string | null;
  estimatedFare: number | null;
  CabsDetail?: {
    cabNumber?: string | null;
  } | null;
}

const HistoryScreen: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const [token, storedDriverId] = await Promise.all([
        AsyncStorage.getItem("userToken"),
        AsyncStorage.getItem("userid"),
      ]);

      const driverId = storedDriverId || "11";
      const url = `https://api.routebudget.com/api/assigncab/driver/${driverId}/completed`;

      const response = await axios.get(url, {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
      });

      const tripList: Trip[] = Array.isArray(response.data?.trips) ? response.data.trips : [];
      setTrips(tripList);
    } catch (fetchError: any) {
      console.log("Error fetching trip history:", fetchError);
      setError(
        fetchError?.response?.data?.message ||
          "Unable to load trip history right now. Please pull to refresh.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory();
  }, [fetchHistory]);

  const renderTripCard = (trip: Trip) => (
    <LinearGradient
      key={trip.id}
      colors={["#fff6e5", "#ffe2b6"]}
      style={styles.tripCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.statusChip}>
          <Icon name="check-decagram" size={16} color="#ffffff" />
          <Text style={styles.statusChipText}>Completed</Text>
        </View>
        <Text style={styles.tripIdText}>#{trip.id}</Text>
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoColumn}>
          <View style={styles.infoItem}>
            <Icon name="account" size={18} color="#f97316" />
            <Text style={styles.infoLabel}>Customer</Text>
          </View>
          <Text style={styles.infoValue} numberOfLines={1}>
            {trip.customerName || "Not provided"}
          </Text>
          <Text style={styles.secondaryValue}>{trip.customerPhone || "-"}</Text>
        </View>

        <View style={styles.infoColumn}>
          <View style={styles.infoItem}>
            <Icon name="car-info" size={18} color="#2563eb" />
            <Text style={styles.infoLabel}>Cab Number</Text>
          </View>
          <Text style={styles.infoValue}>{trip.CabsDetail?.cabNumber || "N/A"}</Text>
          <Text style={styles.secondaryValue}>{trip.tripType || "-"}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.routeRow}>
        <View style={styles.routePoint}>
          <View style={[styles.routeIcon, { backgroundColor: "#22c55e" }]}>
            <Icon name="map-marker" size={16} color="#ffffff" />
          </View>
          <View style={styles.routeTextContainer}>
            <Text style={styles.routeLabel}>Pickup</Text>
            <Text style={styles.routeValue}>{trip.pickupLocation || "Not specified"}</Text>
          </View>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routePoint}>
          <View style={[styles.routeIcon, { backgroundColor: "#f97316" }]}>
            <Icon name="flag-checkered" size={16} color="#ffffff" />
          </View>
          <View style={styles.routeTextContainer}>
            <Text style={styles.routeLabel}>Drop</Text>
            <Text style={styles.routeValue}>{trip.dropLocation || "Not specified"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.fareBadge}>
          <Text style={styles.fareLabel}>Estimated Fare</Text>
          <Text style={styles.fareValue}>
            ₹{trip.estimatedFare !== null ? trip.estimatedFare.toLocaleString() : "0"}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#ffca7cff" />

      <LinearGradient colors={["#ffc46dff", "#ffca7cff"]} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Trip History</Text>
          </View>
          <View style={styles.headerSummary}>
            <Icon name="calendar-check" size={24} color="#ffffff" />
            <Text style={styles.summaryText}>{trips.length} trips</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.contentWrapper}>
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#f97316" />
            <Text style={styles.loaderText}>Loading your completed trips...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={trips.length === 0 && !error ? styles.emptyContent : styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#FFA726"]}
                tintColor="#FFA726"
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {error && (
              <View style={styles.errorContainer}>
                <Icon name="alert-circle" size={22} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!error && trips.length === 0 && (
              <View style={styles.emptyState}>
                <Icon name="history" size={50} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No completed trips yet</Text>
                <Text style={styles.emptySubtitle}>Your completed trips will show up here once available.</Text>
              </View>
            )}

            {trips.map(renderTripCard)}
          </ScrollView>
        )}
      </View>

      <View style={styles.footerContainer}>
        <Footer />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff7ed",
  },
  header: {
    paddingTop: 18,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
  },
  headerSummary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  summaryText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 14,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#334155",
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    textAlign: "center",
    color: "#64748b",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    marginLeft: 8,
    color: "#b91c1c",
    fontSize: 14,
    flex: 1,
  },
  tripCard: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#f97316",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f97316",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusChipText: {
    color: "#ffffff",
    marginLeft: 6,
    fontWeight: "600",
    fontSize: 12,
  },
  tripIdText: {
    color: "#fb923c",
    fontWeight: "700",
    fontSize: 16,
  },
  infoRow: {
    flexDirection: "row",
    marginTop: 16,
  },
  infoColumn: {
    flex: 1,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoLabel: {
    marginLeft: 6,
    color: "#475569",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  secondaryValue: {
    marginTop: 2,
    fontSize: 13,
    color: "#64748b",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(148, 163, 184, 0.2)",
    marginVertical: 16,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  routePoint: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  routeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  routeTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  routeValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },
  routeLine: {
    width: 32,
    height: 1,
    backgroundColor: "rgba(148, 163, 184, 0.35)",
    marginHorizontal: 8,
  },
  footerRow: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  fareBadge: {
    backgroundColor: "rgba(15, 23, 42, 0.08)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  fareLabel: {
    fontSize: 11,
    color: "#475569",
    letterSpacing: 0.5,
  },
  fareValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  footerContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148, 163, 184, 0.2)",
    paddingBottom: 4,
    paddingTop: 6,
    backgroundColor: "#fff7ed",
  },
});

export default HistoryScreen;
