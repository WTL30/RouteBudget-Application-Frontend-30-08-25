import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  ScrollView, 
  Alert 
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import axios from 'react-native-axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CabNumberScreen = ({ navigation }) => {
  const [cabDetails, setCabDetails] = useState(null);
  const [driver, setDriver] = useState(null);

  
  useEffect(() => {
    fetchAssignedCab();
  }, []);

  const fetchAssignedCab = async () => {
    try {
      const token =await AsyncStorage.getItem("userToken")
    
    
    
      
      if(token){
        const response = await axios.get("http://192.168.1.47:5000/api/assignCab/driver",{headers:{
          Authorization:`Bearer ${token}`
        }});
        const assignedCab = response.data[0];
        
        setDriver(assignedCab?.driver);
        setCabDetails(assignedCab?.cab);
      }
      
       
    } catch (error) {
     
      Alert.alert("Error", "Failed to fetch assigned cab data");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color="black" />
      </TouchableOpacity>

      <Text style={styles.title}>Assigned Cab Details</Text>

      {cabDetails && driver ? (
        <View style={styles.card}>
          <Image source={{ uri: cabDetails?.cabImage }} style={styles.image} />
          <Text style={styles.label}>Driver Name: <Text style={styles.value}>{driver.name}</Text></Text>
          <Text style={styles.label}>Cab Number: <Text style={styles.value}>{cabDetails?.cabNumber}</Text></Text>
          <Text style={styles.label}>From: <Text style={styles.value}>{cabDetails.location?.from}</Text></Text>
          <Text style={styles.label}>To: <Text style={styles.value}>{cabDetails.location?.to}</Text></Text>
        </View>
      ) : (
        <Text style={styles.errorText}>No cab assigned yet.</Text>
      )}
    </ScrollView>
  );
};

export default CabNumberScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    width: '100%',
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: 'center',
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 5,
  },
  value: {
    fontWeight: 'normal',
    color: '#555',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  
});
