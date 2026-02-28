import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Profile } from '../lib/types';

// ── Notification presentation handler (foreground) ──────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

// ── Register Expo push token and save to Supabase ────────────────
async function registerPushToken(userId: string) {
  try {
    // Ask for permission
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return;
    }

    // Android requires a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('recall-alerts', {
        name: 'Recall Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#DC2626',
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync('warranty-reminders', {
        name: 'Warranty Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    // Get the push token (requires a real device or Expo Go)
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'warrantyapp',  // Matches app.json slug
    }).catch(() => null);

    if (!tokenData?.data) return;

    // Save token to profile
    await supabase
      .from('profiles')
      .update({ push_token: tokenData.data })
      .eq('id', userId);

    console.log('Push token registered:', tokenData.data.slice(0, 30) + '…');
  } catch (err) {
    // Non-fatal — app works without push
    console.warn('Push registration failed:', err);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data);
  };

  const refreshProfile = async () => {
    if (session?.user?.id) await fetchProfile(session.user.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
        registerPushToken(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
        registerPushToken(session.user.id);
        // Show onboarding for first-time users
        if (_event === 'SIGNED_IN') {
          const done = await AsyncStorage.getItem('onboarding_done');
          if (!done) {
            setTimeout(() => router.push('/onboarding'), 500);
          }
        }
      } else {
        setProfile(null);
      }
    });

    // Listen for incoming notifications while app is open
    const notifListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification.request.content.title);
    });

    // Handle notification tap — navigate to relevant screen
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      console.log('Notification tapped, data:', data);
      if (data?.type === 'warranty' && data?.itemId) {
        router.push(`/items/${data.itemId}`);
      } else if (data?.notificationId) {
        // Recall alert — go to Alerts tab
        router.push('/(tabs)/alerts');
      }
    });

    return () => {
      subscription.unsubscribe();
      Notifications.removeNotificationSubscription(notifListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
