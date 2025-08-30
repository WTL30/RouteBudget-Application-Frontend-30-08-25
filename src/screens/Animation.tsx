// App.js
import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Easing, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const App = () => {
  // Animation values
  const logoAnim = useRef(new Animated.Value(0)).current;
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;
  const dot4Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo bouncing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoAnim, {
          toValue: -30,
          duration: 800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Dot animations in sequence
    const animateDots = () => {
      Animated.loop(
        Animated.sequence([
          // First dot
          Animated.timing(dot1Anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot1Anim, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
          // Second dot
          Animated.timing(dot2Anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot2Anim, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
          // Third dot
          Animated.timing(dot3Anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot3Anim, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
          // Fourth dot
          Animated.timing(dot4Anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot4Anim, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    // Start dots animation
    animateDots();
    
    // Cleanup
    return () => {
      logoAnim.stopAnimation();
      dot1Anim.stopAnimation();
      dot2Anim.stopAnimation();
      dot3Anim.stopAnimation();
      dot4Anim.stopAnimation();
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Bouncing Logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{ translateY: logoAnim }],
          },
        ]}>
        <Image
          source={require('../assets/expengologo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Loading Dots */}
      <View style={styles.dotsContainer}>
        <Animated.View
          style={[
            styles.dot,
            {
              opacity: dot1Anim,
              transform: [
                {
                  scale: dot1Anim.interpolate({
                    inputRange: [0.3, 1],
                    outputRange: [1, 1.5],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            {
              opacity: dot2Anim,
              transform: [
                {
                  scale: dot2Anim.interpolate({
                    inputRange: [0.3, 1],
                    outputRange: [1, 1.5],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            {
              opacity: dot3Anim,
              transform: [
                {
                  scale: dot3Anim.interpolate({
                    inputRange: [0.3, 1],
                    outputRange: [1, 1.5],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            {
              opacity: dot4Anim,
              transform: [
                {
                  scale: dot4Anim.interpolate({
                    inputRange: [0.3, 1],
                    outputRange: [1, 1.5],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: width * 0.7,
    height: width * 0.7,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginTop: 40,
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50', // Green color
    marginHorizontal: 8,
    opacity: 0.3,
  },
});

export default App;