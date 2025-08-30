// Toast.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { CheckCircle, X, AlertCircle, Info } from 'lucide-react-native';

// Toast component props interface
interface ToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  onDismiss: () => void;
}

// Toast component with different types (success, error, info)
const Toast = ({ visible, message, type = 'success', onDismiss }: ToastProps) => {
  const [animation] = useState(new Animated.Value(0));
  
  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.timing(animation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      
      // Auto dismiss after 3 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [visible]);
  
  const handleDismiss = () => {
    Animated.timing(animation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (onDismiss) onDismiss();
    });
  };
  
  // Icon based on type
  const renderIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={22} color="#fff" />;
      case 'error':
        return <AlertCircle size={22} color="#fff" />;
      case 'info':
        return <Info size={22} color="#fff" />;
      default:
        return <CheckCircle size={22} color="#fff" />;
    }
  };
  
  // Background color based on type
  const getBackgroundColor = () => {
    switch (type) {
      case 'success': return '#22c55e';
      case 'error': return '#ef4444';
      case 'info': return '#3b82f6';
      default: return '#22c55e';
    }
  };
  
  if (!visible) return null;
  
  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          backgroundColor: getBackgroundColor(),
          opacity: animation,
          transform: [{ 
            translateY: animation.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0]
            })
          }]
        }
      ]}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {renderIcon()}
        </View>
        <Text style={styles.text}>{message}</Text>
      </View>
      <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
        <X size={16} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 12,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
});

// Create a hook for easy usage across components
export const useToast = () => {
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const hideToast = () => {
    setToastVisible(false);
  };

  // Return both the toast component and the control functions
  const ToastComponent = (
    <Toast
      visible={toastVisible}
      message={toastMessage}
      type={toastType}
      onDismiss={hideToast}
    />
  );

  return {
    showToast,
    hideToast,
    ToastComponent
  };
};

// Export the component directly as well
export default Toast;