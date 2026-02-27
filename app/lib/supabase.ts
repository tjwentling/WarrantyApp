import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://ikfuafcygrfwgayxzwbz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZnVhZmN5Z3Jmd2dheXh6d2J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNTU2MTQsImV4cCI6MjA4NzczMTYxNH0.G_3MT7zee8JNolqggxuV1YKyzNlQtQtcTEjQibvWhdw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
