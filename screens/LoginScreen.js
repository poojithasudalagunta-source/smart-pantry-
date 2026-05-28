import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { supabase } from '../lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [language, setLanguage] = useState('en')

  const text = {
    en: {
      subtitle: 'Never waste food again',
      email: 'Email',
      password: 'Password',
      login: 'Login',
      signUp: 'Sign Up',
      pleaseWait: 'Please wait...',
      haveAccount: 'Already have an account? Login',
      noAccount: "Don't have an account? Sign Up",
      checkEmail: 'Check your email to confirm your account.',
    },
    te: {
      subtitle: 'ఆహారం వృధా చేయకండి',
      email: 'ఇమెయిల్',
      password: 'పాస్‌వర్డ్',
      login: 'లాగిన్',
      signUp: 'సైన్ అప్',
      pleaseWait: 'దయచేసి వేచి ఉండండి...',
      haveAccount: 'ఇప్పటికే ఖాతా ఉందా? లాగిన్',
      noAccount: 'ఖాతా లేదా? సైన్ అప్',
      checkEmail: 'మీ ఇమెయిల్ నిర్ధారించండి.',
    }
  }

  const t = text[language]

  const handleAuth = async () => {
    setLoading(true)
    let error
    if (isSignUp) {
      ({ error } = await supabase.auth.signUp({ email, password }))
      if (!error) alert(t.checkEmail)
    } else {
      const result = await supabase.auth.signInWithPassword({ email, password })
      error = result.error
    }
    if (error) alert('Error: ' + error.message)
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      {/* Language Toggle */}
      <View style={styles.langRow}>
        <TouchableOpacity
          style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
          onPress={() => setLanguage('en')}
        >
          <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>EN</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langBtn, language === 'te' && styles.langBtnActive]}
          onPress={() => setLanguage('te')}
        >
          <Text style={[styles.langText, language === 'te' && styles.langTextActive]}>తె</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.logo}>🥦 SmartPantry</Text>
      <Text style={styles.subtitle}>{t.subtitle}</Text>

      <TextInput
        style={styles.input}
        placeholder={t.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder={t.password}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? t.pleaseWait : isSignUp ? t.signUp : t.login}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
        <Text style={styles.toggle}>
          {isSignUp ? t.haveAccount : t.noAccount}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  langRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 20, gap: 8 },
  langBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  langBtnActive: { backgroundColor: '#22C55E' },
  langText: { fontSize: 13, fontWeight: '600', color: '#888' },
  langTextActive: { color: '#fff' },
  logo: { fontSize: 36, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#888', textAlign: 'center', marginBottom: 40 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 16 },
  button: { backgroundColor: '#22C55E', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  toggle: { color: '#22C55E', textAlign: 'center', fontSize: 14 }
})