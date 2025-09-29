import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import EditProfile from './src/screens/EditProfile';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import CabNumberScreen from './src/screens/CabNumberScreen';
import Profile from './src/screens/Profile';
import Map from './src/screens/Animation';
import CabAssing from './src/screens/CabAssing';
import HistoryScreen from './src/screens/HistoryScreen';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  EditProfile: undefined;
  Profile: undefined;
  AssignCab: undefined;
  CabNumber: undefined;
  History: undefined;
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
      // Ignore error and proceed to hide splash
    } finally {
      setTimeout(() => {
        setIsLoading(false);
      }, 2000);
    }
  };

  if (isLoading) {
    return <Map />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            gestureEnabled: false,
          }}
          initialRouteName={isAuthenticated ? 'Home' : 'Login'}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="EditProfile" component={EditProfile} />
          <Stack.Screen name="Profile" component={Profile} />
          <Stack.Screen name="AssignCab" component={CabAssing} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="CabNumber" component={CabNumberScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
};

export default App;