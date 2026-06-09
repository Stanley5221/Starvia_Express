import React from 'react';
import { ActivityIndicator, View, Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ActiveOrderProvider } from '../context/ActiveOrderContext';
import LoginScreen            from '../screens/LoginScreen';
import AwaitingApprovalScreen from '../screens/AwaitingApprovalScreen';
import ChangePasswordScreen   from '../screens/ChangePasswordScreen';
import HomeScreen             from '../screens/HomeScreen';
import DeliveryScreen         from '../screens/DeliveryScreen';
import EarningsScreen         from '../screens/EarningsScreen';
import HistoryScreen          from '../screens/HistoryScreen';
import ProfileScreen          from '../screens/ProfileScreen';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

const TAB_ICONS = {
  Home:     ['home',          'home-outline'],
  Active:   ['navigate',      'navigate-outline'],
  Earnings: ['wallet',        'wallet-outline'],
  History:  ['time',          'time-outline'],
  Profile:  ['person-circle', 'person-circle-outline'],
};

function MainTabs() {
  const insets    = useSafeAreaInsets();
  const { colors } = useTheme();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'web' ? 28 : 8);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor:  colors.border,
          borderTopWidth:  1,
          height:          58 + bottomPad,
          paddingBottom:   bottomPad,
          paddingTop:      6,
        },
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: 2 },
        tabBarIcon: ({ color, focused, size }) => {
          const [filled, outline] = TAB_ICONS[route.name] || ['ellipse', 'ellipse-outline'];
          return <Ionicons name={focused ? filled : outline} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"     component={HomeScreen}     options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Active"   component={DeliveryScreen} options={{ tabBarLabel: 'Delivery' }} />
      <Tab.Screen name="Earnings" component={EarningsScreen} options={{ tabBarLabel: 'Earnings' }} />
      <Tab.Screen name="History"  component={HistoryScreen}  options={{ tabBarLabel: 'History' }} />
      <Tab.Screen name="Profile"  component={ProfileScreen}  options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading, isApproved, rider, mustChangePassword } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : mustChangePassword ? (
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      ) : !rider || !isApproved ? (
        <Stack.Screen name="AwaitingApproval" component={AwaitingApprovalScreen} />
      ) : (
        <Stack.Screen name="Main">
          {() => (
            <ActiveOrderProvider>
              <MainTabs />
            </ActiveOrderProvider>
          )}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
}
