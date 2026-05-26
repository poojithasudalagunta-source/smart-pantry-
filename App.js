import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { supabase } from './lib/supabase'
import LoginScreen from './screens/LoginScreen'
import AppNavigator from './navigation/AppNavigator'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  if (loading) return <View style={{flex:1,justifyContent:'center',alignItems:'center'}}><ActivityIndicator size="large" color="#22C55E" /></View>

  return session ? <AppNavigator /> : <LoginScreen />
}