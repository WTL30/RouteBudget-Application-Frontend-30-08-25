import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useState, useCallback } from 'react';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const Footer = () => {
  const navigation = useNavigation();
  const route = useRoute(); // Get the current screen name
  const [activeTab, setActiveTab] = useState(route.name);

  useFocusEffect(
    useCallback(() => {
      setActiveTab(route.name);
    }, [route.name])
  );

  const handlePress = (tabName) => {
    navigation.navigate(tabName);
  };

  return (
    <View style={styles.container}>
      {/* Home */}
      <TouchableOpacity onPress={() => handlePress("Home")} style={styles.box}>
        <Ionicons name="home-outline" size={28} color={activeTab === "Home" ? "#F8C146" : "#B2D6EF"} />
        <Text style={[styles.text, activeTab === "Home" && styles.activeText]}>Home</Text>
      </TouchableOpacity>

      {/* Profile */}
      <TouchableOpacity onPress={() => handlePress("AssignCab")} style={styles.box}>
        <Ionicons name="car" size={28} color={activeTab === "AssignCab" ? "#F8C146" : "#B2D6EF"} />
        <Text style={[styles.text, activeTab === "AssignCab" && styles.activeText]}>Assign Cab</Text>
      </TouchableOpacity>
    </View>
  );
};

export default Footer;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 4,
    backgroundColor: "transparent", // Changed to transparent so the LinearGradient from parent shows through
    borderTopWidth: 0, // Removed border since we're using gradient in parent
  },
  box: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 5,
  },
  text: {
    fontSize: 12,
    color: "#B2D6EF", // Matches the lighter blue used in ExpenseTracker
    marginTop: 4,
    fontWeight: "500",
  },
  activeText: {
    color: "#F8C146", // Gold color to match the accent color used elsewhere
    fontWeight: "bold",
  },
});