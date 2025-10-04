import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  StatusBar, 
  SafeAreaView,
  KeyboardAvoidingView, 
  Platform,
  Modal,
  Animated,
  Image,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/FontAwesome';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../../App';

const { width, height } = Dimensions.get('window');
const expengoLogo = require('../assets/expengologo.png');

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailForPass, setEmailForPass] = useState('');
  const [driverId, setDriverId] = useState("");
  const [newPassword, setNewPassword] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loadingVerification, setLoadingVerification] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Remove header animation values since header is removed
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const formTranslateY = useRef(new Animated.Value(50)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const modalScale = useRef(new Animated.Value(0.8)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  const navigation = useNavigation<LoginScreenNavigationProp>();
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  // Initial animations - removed header animations
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(formTranslateY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(formOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  // Modal animations
  useEffect(() => {
    if (showForgotModal) {
      Animated.parallel([
        Animated.timing(modalScale, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(modalScale, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showForgotModal]);

  const handleSignIn = async () => {
  if (!email?.trim() || !password?.trim()) {
    Alert.alert("Error", "Please enter both email and password");
    return;
  }

  // Button press animation
  Animated.sequence([
    Animated.timing(buttonScale, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true,
    }),
    Animated.timing(buttonScale, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }),
  ]).start();

  try {
    console.log("📩 Sending login request", email.trim(), password.trim());
    setIsLoading(true);

    const response = await axios.post(
      "https://api.routebudget.com/api/login",
      {
        email: email.trim(),
        password: password.trim(),
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    console.log("✅ Login Response:", response.data);

    const receivedToken = response.data?.token;

    if (receivedToken) {
      console.log("🔑 Received Token:", receivedToken);

      // Save token
      await AsyncStorage.setItem("userToken", receivedToken);
      console.log("💾 Token saved to AsyncStorage");

      // Confirm token saved
      const savedToken = await AsyncStorage.getItem("userToken");
      console.log("📦 Token retrieved from storage:", savedToken);

      // Navigate to home
      navigation.reset({
        index: 0,
        routes: [{ name: "Home" }],
      });
    } else {
      Alert.alert("Login Failed", "No token received from server.");
    }
  } catch (error: any) {
    console.error("❌ Login error:", error?.response || error?.message || error);
    Alert.alert(
      "Login Failed",
      error?.response?.data?.message || "Invalid credentials. Please try again."
    );
  } finally {
    setIsLoading(false);
  }
};

  const verifyEmail = async () => {
    if (!emailForPass) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    
    setLoadingVerification(true);
    
    try {
      const res = await axios.post("https://api.routebudget.com/api/driver/forgot-password", {
        email: emailForPass
      });
      setDriverId(res.data.driverId);
      setEmailVerified(true);
      setLoadingVerification(false);
    } catch (error) {
      setLoadingVerification(false);
      Alert.alert('Verification Failed', 'Could not verify your email. Please try again.');
    }
  };
  
  const submitNewPassword = async () => {
    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }
    
    try {
      if (newPassword.length < 6) {
        Alert.alert('Invalid Password', 'Password should be at least 6 characters long.');
        return;
      }
      
      if(driverId){
        const res = await axios.post("https://api.routebudget.com/api/driver/reset-password", {
          driverId: driverId,
          newPassword: newPassword
        });
      }
      
      Alert.alert('Success', 'Your password has been reset successfully');
      setShowForgotModal(false);
      setEmailVerified(false);
      setEmailForPass('');
      setNewPassword('');
    } catch (error) {
      Alert.alert('Reset Failed', 'Could not reset your password. Please try again.');
    }
  };

  const handleForgotPassword = () => {
    setShowForgotModal(true);
    setEmailVerified(false);
    setEmailForPass('');
    setNewPassword('');
  };

  const handleInputTap = (inputType: string) => {
    if (inputType === 'email') {
      setEmailFocused(true);
      setPasswordFocused(false);
      emailInputRef.current?.focus();
    } else if (inputType === 'password') {
      setPasswordFocused(true);
      setEmailFocused(false);
      passwordInputRef.current?.focus();
    }
  };

  const handleDismissKeyboard = () => {
    Keyboard.dismiss();
    setEmailFocused(false);
    setPasswordFocused(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#FFC107" barStyle="dark-content" />
      
      <TouchableWithoutFeedback onPress={handleDismissKeyboard}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidView}
        >
          
          <View style={styles.contentContainer}>
            {/* Logo Section with animation */}
            <Animated.View 
              style={[
                styles.logoContainer,
                {
                  transform: [{ scale: logoScale }],
                  opacity: logoOpacity,
                }
              ]}
            >
              <View style={styles.logoWrapper}>
                <Image 
                  source={expengoLogo} 
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              
              <Text style={styles.welcomeText}>Welcome Back</Text>
              <Text style={styles.subtitleText}>Sign in to continue your journey</Text>
            </Animated.View>
            
            {/* Form Section with animation */}
            <Animated.View 
              style={[
                styles.formContainer,
                {
                  transform: [{ translateY: formTranslateY }],
                  opacity: formOpacity,
                }
              ]}
            >
              <View style={styles.inputSection}>
                {/* Email Input */}
                <TouchableOpacity 
                  style={[
                    styles.inputWrapper, 
                    emailFocused && styles.inputWrapperFocused,
                    email && styles.inputWrapperActive
                  ]}
                  activeOpacity={1}
                  onPress={() => handleInputTap('email')}
                >
                  <View style={styles.inputIconContainer}>
                    <Icon 
                      name="envelope" 
                      size={18} 
                      color={emailFocused ? "#FFC107" : "#718096"} 
                    />
                  </View>
                  
                  {(emailFocused || email.length > 0) && (
                    <Text style={[styles.floatingLabel, emailFocused && styles.floatingLabelActive]}>
                      Email Address
                    </Text>
                  )}
                  
                  <TextInput
                    ref={emailInputRef}
                    style={styles.input}
                    placeholder={emailFocused || email.length > 0 ? "" : "Email Address"}
                    placeholderTextColor="#9E9E9E"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onFocus={() => {
                      setEmailFocused(true);
                      setPasswordFocused(false);
                    }}
                    onBlur={() => {
                      if (!email) {
                        setEmailFocused(false);
                      }
                    }}
                  />
                </TouchableOpacity>
                
                {/* Password Input */}
                <TouchableOpacity 
                  style={[
                    styles.inputWrapper, 
                    passwordFocused && styles.inputWrapperFocused,
                    password && styles.inputWrapperActive
                  ]}
                  activeOpacity={1}
                  onPress={() => handleInputTap('password')}
                >
                  <View style={styles.inputIconContainer}>
                    <Icon 
                      name="lock" 
                      size={20} 
                      color={passwordFocused ? "#FFC107" : "#718096"} 
                    />
                  </View>
                  
                  {(passwordFocused || password.length > 0) && (
                    <Text style={[styles.floatingLabel, passwordFocused && styles.floatingLabelActive]}>
                      Password
                    </Text>
                  )}
                  
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.input}
                    placeholder={passwordFocused || password.length > 0 ? "" : "Password"}  
                    placeholderTextColor="#9E9E9E"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => {
                      setPasswordFocused(true);
                      setEmailFocused(false);
                    }}
                    onBlur={() => {
                      if (!password) {
                        setPasswordFocused(false);
                      }
                    }}
                  />
                  
                  <TouchableOpacity 
                    onPress={() => setShowPassword(!showPassword)} 
                    style={styles.toggleButton}
                  >
                    <Icon 
                      name={showPassword ? "eye-slash" : "eye"} 
                      size={18} 
                      color="#757575" 
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
              
              <View style={styles.forgotContainer}>
                <TouchableOpacity onPress={handleForgotPassword}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
              
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity 
                  style={[styles.loginButton, isLoading && styles.loginButtonDisabled]} 
                  onPress={handleSignIn} 
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.loadingText}>Signing In...</Text>
                    </View>
                  ) : (
                    <View style={styles.buttonContent}>
                      <Text style={styles.loginButtonText}>Sign In</Text>
                      <Icon name="arrow-right" size={16} color="#FFFFFF" style={styles.buttonIcon} />
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
      
      {/* Enhanced Forgot Password Modal */}
      <Modal
        visible={showForgotModal}
        transparent={true}
        animationType="none"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View 
                style={[
                  styles.modalCard,
                  {
                    transform: [{ scale: modalScale }],
                    opacity: modalOpacity,
                  }
                ]}
              >
                <TouchableOpacity 
                  style={styles.closeButton} 
                  onPress={() => setShowForgotModal(false)}
                >
                  <Icon name="times" size={20} color="#666" />
                </TouchableOpacity>
                
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconContainer}>
                    <Icon name="lock" size={28} color="#FFC107" />
                  </View>
                  <Text style={styles.cardTitle}>
                    {emailVerified ? 'Create New Password' : 'Reset Password'}
                  </Text>
                </View>
                
                {!emailVerified ? (
                  <>
                    <Text style={styles.cardDescription}>
                      Enter your email address and we'll help you reset your password
                    </Text>
                    <View style={styles.cardInputWrapper}>
                      <Icon 
                        name="envelope" 
                        size={18} 
                        color="#757575" 
                        style={styles.cardInputIcon}
                      />
                      <TextInput
                        style={styles.cardInput}
                        placeholder="Enter your email address"
                        placeholderTextColor="#9E9E9E"
                        value={emailForPass}
                        onChangeText={setEmailForPass}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                    </View>
                    <TouchableOpacity 
                      style={[styles.cardButton, loadingVerification && styles.cardButtonDisabled]}
                      onPress={verifyEmail}
                      disabled={loadingVerification}
                    >
                      {loadingVerification ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.cardButtonText}>Verify Email</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.cardDescription}>
                      Email verified successfully! Enter your new password below
                    </Text>
                    <View style={styles.cardInputWrapper}>
                      <Icon 
                        name="lock" 
                        size={18} 
                        color="#757575" 
                        style={styles.cardInputIcon}
                      />
                      <TextInput
                        style={styles.cardInput}
                        placeholder="Enter new password (min. 6 characters)"
                        placeholderTextColor="#9E9E9E"
                        secureTextEntry={true}
                        value={newPassword}
                        onChangeText={setNewPassword}
                      />
                    </View>
                    <TouchableOpacity 
                      style={styles.cardButton}
                      onPress={submitNewPassword}
                    >
                      <Text style={styles.cardButtonText}>Update Password</Text>
                    </TouchableOpacity>
                  </>
                )}
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDE7',
  },
  keyboardAvoidView: {
    flex: 1,
  },
  headerGradient: {
    backgroundColor: '#FF8C42',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: 10,
    shadowColor: '#FF8C42',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogoContainer: {
    width: 45,
    height: 45,
    backgroundColor: '#FFFFFF',
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerLogoText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF8C42',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  sosButton: {
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#FF6B6B',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  sosText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 6,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    paddingTop: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoWrapper: {
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  logo: {
    width: 100,
    height: 100,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 15,
    color: '#718096',
    textAlign: 'center',
    fontWeight: '500',
  },
  formContainer: {
    width: '100%',
  },
  inputSection: {
    marginBottom: 20,
  },
  inputWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 60,
    paddingHorizontal: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  inputWrapperFocused: {
    borderColor: '#FFC107',
    shadowOpacity: 0.15,
    elevation: 6,
    backgroundColor: '#fefefe',
  },
  inputWrapperActive: {
    backgroundColor: '#fafafa',
  },
  inputIconContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  floatingLabel: {
    position: 'absolute',
    left: 16,
    top: -10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    fontSize: 12,
    color: '#757575',
    fontWeight: '500',
    zIndex: 1,
  },
  floatingLabelActive: {
    color: '#FFC107',
    fontWeight: '600',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#212121',
    fontWeight: '500',
  },
  toggleButton: {
    padding: 8,
    marginLeft: 8,
  },
  forgotContainer: {
    alignItems: 'flex-end',
    marginBottom: 28,
  },
  forgotText: {
    color: '#FFC107',
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#FFC107',
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFC107',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  loginButtonDisabled: {
    backgroundColor: 'rgba(255, 193, 7, 0.7)',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(45, 55, 72, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 15,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  cardIconContainer: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2d3748',
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  cardInputWrapper: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  cardInputIcon: {
    marginRight: 12,
  },
  cardInput: {
    flex: 1,
    fontSize: 16,
    color: '#212121',
    fontWeight: '500',
  },
  cardButton: {
    backgroundColor: '#FFC107',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFC107',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  cardButtonDisabled: {
    backgroundColor: 'rgba(255, 193, 7, 0.7)',
  },
  cardButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default LoginScreen;