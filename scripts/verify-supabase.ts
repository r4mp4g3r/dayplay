
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are required.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
    console.log('Testing network connectivity...');
    try {
        const res = await fetch('https://google.com');
        console.log('Google reachability:', res.status);
    } catch (err) {
        console.error('Failed to reach Google:', err);
    }

    console.log('\nTesting Supabase connection...');
    console.log('URL:', supabaseUrl);

    try {
        const { data, error, count } = await supabase
            .from('listings')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Supabase Error:', error);
            console.error('Message:', error.message);
            // PVS: sometimes error is wrapped
            if (error && (error as any).cause) {
                console.error('Cause:', (error as any).cause);
            }
        } else {
            console.log('Successfully connected to Supabase!');
            console.log(`Found ${count} listings.`);
        }

    } catch (err) {
        console.error('Unexpected error:', err);
        if (err instanceof TypeError && err.cause) {
            console.error('Cause:', err.cause);
        }
    }
}

testConnection();
