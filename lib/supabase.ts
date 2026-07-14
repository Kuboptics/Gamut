// Single shared Supabase client for the whole app. This is only a
// connection to the backend — nothing in the game currently requires
// it. It exists so later social features (Phase 3+) have one place to
// import from instead of each screen creating its own client.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Check your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // AsyncStorage keeps the user's session on the device between app
    // launches, the same way Expo Go apps already store other data.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // There's no browser URL in a native app, so this only matters on web.
    detectSessionInUrl: false,
  },
});
