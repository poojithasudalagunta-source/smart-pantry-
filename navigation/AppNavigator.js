import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'

import HomeScreen from '../screens/HomeScreen'
import AddItemScreen from '../screens/AddItemScreen'
import RecipesScreen from '../screens/RecipesScreen'
import ShoppingScreen from '../screens/ShoppingScreen'
import HouseholdScreen from '../screens/HouseholdScreen'
import BillScannerScreen from '../screens/BillScannerScreen'
import AgentScreen from '../screens/AgentScreen'

const Tab = createBottomTabNavigator()

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#22C55E',
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="Pantry"
          component={HomeScreen}
          options={{ tabBarIcon: () => <Text>🏠</Text> }}
        />
        <Tab.Screen
          name="Add"
          component={AddItemScreen}
          options={{ tabBarIcon: () => <Text>➕</Text> }}
        />
        <Tab.Screen
          name="Scan Bill"
          component={BillScannerScreen}
          options={{ tabBarIcon: () => <Text>📸</Text> }}
        />
        <Tab.Screen
          name="Agent"
          component={AgentScreen}
          options={{ tabBarIcon: () => <Text>🤖</Text> }}
        />
        <Tab.Screen
          name="Recipes"
          component={RecipesScreen}
          options={{ tabBarIcon: () => <Text>🍳</Text> }}
        />
        <Tab.Screen
          name="Shopping"
          component={ShoppingScreen}
          options={{ tabBarIcon: () => <Text>🛒</Text> }}
        />
        <Tab.Screen
          name="Household"
          component={HouseholdScreen}
          options={{ tabBarIcon: () => <Text>👨‍👩‍👧</Text> }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  )
}