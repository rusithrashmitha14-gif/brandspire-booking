import { createClient } from '@supabase/supabase-js';

// We fall back to localhost for local development without a cloud project
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJh...'; // Replace with local anon key later

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
