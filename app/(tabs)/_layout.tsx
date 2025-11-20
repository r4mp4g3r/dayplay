import React, { useEffect } from 'react';
import { Text } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useBusinessStore } from '@/state/businessStore';
import { useAuthStore } from '@/state/authStore';

function TabBarIcon(props: { name: React.ComponentProps<typeof FontAwesome>['name']; color: string }) {
  return <FontAwesome size={22} style={{ marginBottom: -2 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { hasBusinessProfile, refreshHasBusinessProfile } = useBusinessStore();
  const { user } = useAuthStore();

  useEffect(() => {
    // Refresh business profile presence whenever auth user changes
    refreshHasBusinessProfile();
  }, [user?.id]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => <TabBarIcon name="compass" color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color }) => <TabBarIcon name="heart" color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <TabBarIcon name="map" color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="locals"
        options={{
          title: 'Locals',
          tabBarIcon: () => <Text>💎</Text>,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
          headerShown: false,
        }}
      />
      {hasBusinessProfile && (
        <Tabs.Screen
          name="business"
          options={{
            title: 'Business',
            tabBarIcon: ({ color }) => <TabBarIcon name="briefcase" color={color} />,
            headerShown: false,
          }}
        />
      )}
    </Tabs>
  );
}
