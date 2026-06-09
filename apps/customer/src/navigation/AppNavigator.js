import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Animated } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, shadow } from '../constants/theme';

import OnboardingScreen        from '../screens/OnboardingScreen';
import LoginScreen             from '../screens/LoginScreen';
import RegisterScreen          from '../screens/RegisterScreen';
import HomeScreen              from '../screens/HomeScreen';
import OrdersScreen            from '../screens/OrdersScreen';
import PlaceOrderScreen        from '../screens/PlaceOrderScreen';
import TrackOrderScreen        from '../screens/TrackOrderScreen';
import ProfileScreen           from '../screens/ProfileScreen';
import NotificationsScreen     from '../screens/NotificationsScreen';
import ChangePasswordScreen    from '../screens/ChangePasswordScreen';
import SavedAddressesScreen    from '../screens/SavedAddressesScreen';
import BusinessDashboardScreen from '../screens/BusinessDashboardScreen';
import BusinessDocumentsScreen from '../screens/BusinessDocumentsScreen';
import BusinessProfileScreen   from '../screens/BusinessProfileScreen';
import BusinessOrdersScreen    from '../screens/BusinessOrdersScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Animated tab icon ────────────────────────────────────────────────────────
function TabIcon({ name, focused, color }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.18 : 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, [focused]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name={name} size={22} color={color} />
    </Animated.View>
  );
}

// ── Custom center "Send" tab button ──────────────────────────────────────────
function SendButton({ onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,   duration: 80, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <TouchableOpacity onPress={press} activeOpacity={1} style={styles.sendWrap}>
      <Animated.View style={[styles.sendBtn, { transform: [{ scale }] }]}>
        <Ionicons name="add" size={28} color={colors.white} />
      </Animated.View>
      <Text style={styles.sendLabel}>Send</Text>
    </TouchableOpacity>
  );
}

// ── Notification bell header button ──────────────────────────────────────────
function NotificationBell({ navigation }) {
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Notifications')}
      style={{ paddingHorizontal: 14, paddingVertical: 8 }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.text} />
    </TouchableOpacity>
  );
}

// ── Main tab navigator ────────────────────────────────────────────────────────
function MainTabs({ navigation }) {
  const insets      = useSafeAreaInsets();
  const { isBusiness } = useAuth();
  const tabH        = 56 + Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // Business dashboard manages its own header; individual home uses the tab header
        headerShown: route.name === 'Home' && !isBusiness,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitle: () => <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>Starvia Express</Text>,
        headerRight: () => <NotificationBell navigation={navigation} />,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: tabH,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
          ...shadow.md,
        },
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: 2 },
      })}
    >
      <Tab.Screen
        name="Home"
        component={isBusiness ? BusinessDashboardScreen : HomeScreen}
        options={{
          tabBarLabel: isBusiness ? 'Dashboard' : 'Home',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              name={isBusiness
                ? (focused ? 'grid' : 'grid-outline')
                : (focused ? 'home' : 'home-outline')}
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarIcon: ({ focused, color }) => <TabIcon name={focused ? 'receipt' : 'receipt-outline'} focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="Send"
        component={PlaceOrderScreen}
        options={{
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: (props) => <SendButton onPress={props.onPress} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused, color }) => <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ── Root navigator ────────────────────────────────────────────────────────────
export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {!user ? (
        <>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login"      component={LoginScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Register"   component={RegisterScreen} options={{ animation: 'slide_from_right' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen
            name="TrackOrder"
            component={TrackOrderScreen}
            options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
          />
          <Stack.Screen name="Notifications"     component={NotificationsScreen}     options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="ChangePassword"    component={ChangePasswordScreen}    options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="SavedAddresses"    component={SavedAddressesScreen}    options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="BusinessDashboard" component={BusinessDashboardScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="BusinessDocuments" component={BusinessDocumentsScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="BusinessProfile"   component={BusinessProfileScreen}   options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="BusinessOrders"    component={BusinessOrdersScreen}    options={{ animation: 'slide_from_right' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  sendWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 70,
    paddingBottom: 6,
  },
  sendBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    ...shadow.brand,
  },
  sendLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
  },
});
