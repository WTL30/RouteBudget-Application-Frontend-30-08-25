import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import EditProfile from './src/screens/EditProfile';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import StickyFooterLayout from './src/screens/footer/StickyFooter';
import Footer from './src/screens/footer/Footer';
import CabNumberScreen from './src/screens/CabNumberScreen';
import FastTagPaymentScreen from './src/screens/FastTagPaymentScreen';
import FuelPaymentScreen from './src/screens/FuelPaymentScreen';
import TyrePunctureScreen from './src/screens/TyrePunctureScreen';
import ReportProblemScreen from './src/screens/ReportProblemScreen';
import VehicleServiceScreen from './src/screens/VehicleServiceScreen';
import LocationScreen from './src/screens/LocationScreen';
import Profile from './src/screens/Profile';
import Map from "./src/screens/Animation"
import OdometerReading from './src/screens/OdometerReading';
import CabAssing from './src/screens/CabAssing';
import CustomerDetailScreen from './src/screens/CustomerDetailScreen';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      setIsAuthenticated(!!token);
    } catch (error) {
    } finally {
      setTimeout(() => {
        setIsLoading(false);
      }, 2000);
    }
  };

  if (isLoading) {
    return (
      <Map/>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      
        <NavigationContainer>
       
          <Stack.Navigator 
            screenOptions={{ 
              headerShown: false,
              gestureEnabled: false 
            }}
            initialRouteName={isAuthenticated ? "Home" : "Login"}
          >
            <Stack.Screen 
              name="Login" 
              component={LoginScreen} 
            />
            <Stack.Screen 
              name="Home" 
              component={HomeScreen} 
            />
            <Stack.Screen 
              name="EditProfile" 
              component={EditProfile} 
            />
            <Stack.Screen 
              name="Profile" 
              component={Profile} 
            />
             <Stack.Screen 
              name="AssignCab" 
              component={CabAssing} 
            />
              <Stack.Screen 
              name="CabNumber" 
              component={CabNumberScreen} 
            />
              <Stack.Screen 
              name="FastTag" 
              component={FastTagPaymentScreen} 
            />
              <Stack.Screen 
              name="FuelStatus" 
              component={FuelPaymentScreen} 
            />
              <Stack.Screen 
              name="TyrePuncture" 
              component={TyrePunctureScreen} 
            />
             <Stack.Screen 
              name="ReportProblem" 
              component={ReportProblemScreen} 
            />
            <Stack.Screen 
              name="VehicleService" 
              component={VehicleServiceScreen} 
            />
            <Stack.Screen 
              name="Location" 
              component={LocationScreen} 
            />
            <Stack.Screen
              name="Customer"
              component={CustomerDetailScreen}
            />
             <Stack.Screen 
              name="Odometer" 
              component={OdometerReading} 
            />

          </Stack.Navigator>
          
        </NavigationContainer>
     
    </GestureHandlerRootView>
  );
};

export default App;