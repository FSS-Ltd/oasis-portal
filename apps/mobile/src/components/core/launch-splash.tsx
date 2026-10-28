import { useAuth } from '@clerk/clerk-expo';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Platform, StyleSheet } from 'react-native';
import CREST from '../../../assets/splash-icon.png';
import { C } from './mobile-theme';

// Same image and size as the native splash in app.json, so the handoff has no visible jump.
const CREST_SIZE = 200;
const RIPPLES = 3;
const INTRO_MS = 900;
// Never trap the user behind the splash if auth stalls; the index route has its own loading state.
const MAX_WAIT_MS = 4000;

const useNativeDriver = Platform.OS !== 'web';

// Keep the native splash up until our first frame (the crest) has painted.
SplashScreen.preventAutoHideAsync().catch(() => {});

export function LaunchSplash() {
  const { isLoaded } = useAuth();
  const [reduceMotion, setReduceMotion] = useState(false);
  // True once the native splash has been released, so no part of the intro plays hidden under it.
  const [revealed, setRevealed] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [gone, setGone] = useState(false);

  const halo = useRef(new Animated.Value(0)).current;
  const crest = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const ripples = useRef(Array.from({ length: RIPPLES }, () => new Animated.Value(0))).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
    const maxTimer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      setTimedOut(true);
    }, MAX_WAIT_MS);
    return () => {
      clearTimeout(maxTimer);
    };
  }, []);

  useEffect(() => {
    if (!revealed) return;
    const introTimer = setTimeout(() => {
      setIntroDone(true);
    }, INTRO_MS);
    return () => {
      clearTimeout(introTimer);
    };
  }, [revealed]);

  // Intro: halo warms up, crest breathes once, rings ripple outward until auth is ready.
  useEffect(() => {
    if (reduceMotion || !revealed) return;
    const intro = Animated.parallel([
      Animated.timing(halo, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }),
      Animated.timing(crest, {
        toValue: 1,
        duration: 900,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver,
      }),
    ]);
    const rippleLoop = Animated.loop(
      Animated.stagger(
        360,
        ripples.map((r) =>
          Animated.sequence([
            Animated.timing(r, {
              toValue: 1,
              duration: 1800,
              easing: Easing.out(Easing.quad),
              useNativeDriver,
            }),
            Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver }),
          ]),
        ),
      ),
    );
    intro.start();
    rippleLoop.start();
    return () => {
      intro.stop();
      rippleLoop.stop();
    };
  }, [reduceMotion, revealed, halo, crest, ripples]);

  useEffect(() => {
    if (exiting || !((isLoaded && introDone) || timedOut)) return;
    setExiting(true);
    Animated.timing(exit, {
      toValue: 1,
      duration: reduceMotion ? 200 : 480,
      easing: Easing.in(Easing.cubic),
      useNativeDriver,
    }).start(() => {
      setGone(true);
    });
  }, [isLoaded, introDone, timedOut, exiting, reduceMotion, exit]);

  if (gone) return null;

  const crestScale = reduceMotion
    ? 1
    : Animated.add(
        crest.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.04, 1] }),
        exit.interpolate({ inputRange: [0, 1], outputRange: [0, 0.14] }),
      );

  return (
    <Animated.View
      pointerEvents={exiting ? 'none' : 'auto'}
      style={[
        styles.overlay,
        { opacity: exit.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1, 0] }) },
      ]}
    >
      {!reduceMotion && (
        <>
          <Animated.View
            style={[
              styles.halo,
              {
                opacity: halo,
                transform: [
                  { scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                ],
              },
            ]}
          />
          {ripples.map((r, i) => (
            <Animated.View
              key={i}
              style={[
                styles.ripple,
                {
                  opacity: Animated.multiply(
                    r.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
                    exit.interpolate({
                      inputRange: [0, 0.4],
                      outputRange: [1, 0],
                      extrapolate: 'clamp',
                    }),
                  ),
                  transform: [
                    { scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.75, 2.6] }) },
                  ],
                },
              ]}
            />
          ))}
        </>
      )}
      <Animated.View
        style={{
          opacity: exit.interpolate({
            inputRange: [0, 0.7],
            outputRange: [1, 0],
            extrapolate: 'clamp',
          }),
          transform: [{ scale: crestScale }],
        }}
      >
        <Image
          accessibilityLabel="Oasis Learning Centre"
          fadeDuration={0}
          onLoadEnd={() => {
            SplashScreen.hideAsync()
              .catch(() => {})
              .finally(() => {
                setRevealed(true);
              });
          }}
          source={CREST}
          style={styles.crest}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  crest: {
    height: CREST_SIZE,
    width: CREST_SIZE,
  },
  halo: {
    // Disc and first shadow share a colour so the bloom has no visible edge.
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: CREST_SIZE,
    boxShadow: '0 0 40px 28px rgba(255,255,255,0.9), 0 0 120px 70px rgba(91,144,197,0.22)',
    height: CREST_SIZE * 0.9,
    position: 'absolute',
    width: CREST_SIZE * 0.9,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: C.bg,
    justifyContent: 'center',
    zIndex: 10,
  },
  ripple: {
    borderColor: C.blue,
    borderRadius: CREST_SIZE,
    borderWidth: 1.5,
    height: CREST_SIZE,
    position: 'absolute',
    width: CREST_SIZE,
  },
});
