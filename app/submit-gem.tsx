import { Redirect } from 'expo-router';

// Redirect to the unified Locals' Favorites submission form
export default function SubmitGemScreen() {
  return <Redirect href="/locals-favorites/add" />;
}

