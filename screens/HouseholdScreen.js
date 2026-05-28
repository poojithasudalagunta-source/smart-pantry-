import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Share, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../lib/LanguageContext'

export default function HouseholdScreen() {
  const [step, setStep] = useState('loading')
  const [displayName, setDisplayName] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [household, setHousehold] = useState(null)
  const [members, setMembers] = useState([])
  const [currentUserId, setCurrentUserId] = useState(null)
  const [saving, setSaving] = useState(false)
  const { t, language } = useLanguage()

  useEffect(() => {
    initScreen()
  }, [])

  const initScreen = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setCurrentUserId(session.user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (!profile || !profile.display_name) {
      setStep('setName')
      return
    }

    const { data: memberRows } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', session.user.id)

    if (!memberRows || memberRows.length === 0) {
      setStep('createOrJoin')
      return
    }

    const householdId = memberRows[0].household_id

    const { data: householdData } = await supabase
      .from('households')
      .select('*')
      .eq('id', householdId)
      .single()

    if (!householdData) {
      setStep('createOrJoin')
      return
    }

    setHousehold(householdData)
    await fetchMembers(householdId)
    setStep('dashboard')
  }

  const fetchMembers = async (householdId) => {
    const { data: memberData } = await supabase
      .from('household_members')
      .select('user_id')
      .eq('household_id', householdId)

    if (!memberData) return

    const userIds = memberData.map(m => m.user_id)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', userIds)

    const merged = memberData.map(m => ({
      user_id: m.user_id,
      display_name: profileData?.find(p => p.id === m.user_id)?.display_name || (language === 'te' ? 'తెలియదు' : 'Unknown')
    }))

    setMembers(merged)
  }

  const saveName = async () => {
    if (!displayName.trim()) return alert(language === 'te' ? 'దయచేసి మీ పేరు నమోదు చేయండి!' : 'Please enter your name!')
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, display_name: displayName.trim() })
    if (error) alert(error.message)
    else setStep('createOrJoin')
    setSaving(false)
  }

  const createHousehold = async () => {
    if (!householdName.trim()) return alert(language === 'te' ? 'దయచేసి గృహం పేరు నమోదు చేయండి!' : 'Please enter a household name!')
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()

    const { data: existing } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', session.user.id)

    if (existing && existing.length > 0) {
      alert(language === 'te' ? 'మీరు ఇప్పటికే ఒక గృహంలో ఉన్నారు!' : 'You are already in a household! Leave it first to create a new one.')
      setSaving(false)
      return
    }

    const { data, error } = await supabase
      .from('households')
      .insert({ name: householdName.trim() })
      .select()
      .single()

    if (error) { alert(error.message); setSaving(false); return }

    const { error: memberError } = await supabase
      .from('household_members')
      .insert({ household_id: data.id, user_id: session.user.id })

    if (memberError) { alert(memberError.message); setSaving(false); return }

    setHousehold(data)
    await fetchMembers(data.id)
    setStep('dashboard')
    setSaving(false)
  }

  const joinHousehold = async () => {
    if (!inviteCode.trim()) return alert(language === 'te' ? 'దయచేసి ఆహ్వాన కోడ్ నమోదు చేయండి!' : 'Please enter an invite code!')
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()

    const { data: existing } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', session.user.id)

    if (existing && existing.length > 0) {
      alert(language === 'te' ? 'మీరు ఇప్పటికే ఒక గృహంలో ఉన్నారు!' : 'You are already in a household! Leave it first to join another.')
      setSaving(false)
      return
    }

    const { data: householdData, error } = await supabase
      .from('households')
      .select('*')
      .eq('invite_code', inviteCode.trim().toLowerCase())
      .single()

    if (error || !householdData) {
      alert(language === 'te' ? 'తప్పు ఆహ్వాన కోడ్! దయచేసి మళ్ళీ ప్రయత్నించండి.' : 'Invalid invite code! Please check and try again.')
      setSaving(false)
      return
    }

    const { error: joinError } = await supabase
      .from('household_members')
      .insert({ household_id: householdData.id, user_id: session.user.id })

    if (joinError) { alert(joinError.message); setSaving(false); return }

    setHousehold(householdData)
    await fetchMembers(householdData.id)
    setStep('dashboard')
    setSaving(false)
  }

  const leaveHousehold = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('user_id', session.user.id)
      .eq('household_id', household.id)

    if (error) alert(error.message)
    else {
      setHousehold(null)
      setMembers([])
      setStep('createOrJoin')
    }
  }

  const shareInviteCode = () => {
    Share.share({
      message: language === 'te'
        ? `నా SmartPantry గృహంలో చేరండి "${household.name}"! ఆహ్వాన కోడ్: ${household.invite_code} 🥦`
        : `Join my SmartPantry household "${household.name}"! Use invite code: ${household.invite_code} 🥦`,
    })
  }

  if (step === 'loading') return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#22C55E" />
    </View>
  )

  if (step === 'setName') return (
    <View style={styles.center}>
      <Text style={styles.emoji}>👋</Text>
      <Text style={styles.bigTitle}>{t.whatToCallYou}</Text>
      <Text style={styles.subtitle}>{t.nameVisible}</Text>
      <TextInput
        style={styles.input}
        placeholder={language === 'te' ? 'ఉదా: పూజిత' : 'e.g. Poojitha'}
        value={displayName}
        onChangeText={setDisplayName}
        autoFocus
      />
      <TouchableOpacity style={styles.button} onPress={saveName} disabled={saving}>
        <Text style={styles.buttonText}>
          {saving ? (language === 'te' ? 'సేవ్ అవుతోంది...' : 'Saving...') : t.continue}
        </Text>
      </TouchableOpacity>
    </View>
  )

  if (step === 'createOrJoin') return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>👨‍👩‍👧 {t.household}</Text>
      <Text style={styles.subtitle}>{t.createOrJoin}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏠 {t.createHousehold}</Text>
        <TextInput
          style={styles.input}
          placeholder={t.householdName}
          value={householdName}
          onChangeText={setHouseholdName}
        />
        <TouchableOpacity style={styles.button} onPress={createHousehold} disabled={saving}>
          <Text style={styles.buttonText}>
            {saving ? (language === 'te' ? 'సృష్టిస్తోంది...' : 'Creating...') : t.createHousehold}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{language === 'te' ? 'లేదా' : 'or'}</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔗 {t.joinHousehold}</Text>
        <TextInput
          style={styles.input}
          placeholder={t.enterInviteCode}
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="none"
          maxLength={6}
        />
        <TouchableOpacity style={[styles.button, styles.joinBtn]} onPress={joinHousehold} disabled={saving}>
          <Text style={styles.buttonText}>
            {saving ? (language === 'te' ? 'చేరుతోంది...' : 'Joining...') : t.joinHousehold}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>👨‍👩‍👧 {household?.name}</Text>

      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>{t.inviteCode}</Text>
        <Text style={styles.code}>{household?.invite_code?.toUpperCase()}</Text>
        <TouchableOpacity style={styles.shareBtn} onPress={shareInviteCode}>
          <Text style={styles.shareBtnText}>📤 {t.shareWithFamily}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>{t.members} ({members.length})</Text>
      {members.map((m, i) => (
        <View key={i} style={styles.memberCard}>
          <View style={styles.memberAvatar}>
            <Text style={styles.memberAvatarText}>
              {m.display_name?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          <Text style={styles.memberName}>
            {m.display_name}
            {m.user_id === currentUserId ? (language === 'te' ? ' (మీరు)' : ' (You)') : ''}
          </Text>
        </View>
      ))}

      <TouchableOpacity style={styles.leaveBtn} onPress={leaveHousehold}>
        <Text style={styles.leaveBtnText}>🚪 {t.leaveHousehold}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F9FAFB' },
  emoji: { fontSize: 48, marginBottom: 12 },
  bigTitle: { fontSize: 22, fontWeight: '700', color: '#111', textAlign: 'center', marginBottom: 8 },
  header: { fontSize: 24, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 24, textAlign: 'center' },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 12 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 12 },
  button: { backgroundColor: '#22C55E', borderRadius: 12, padding: 16, alignItems: 'center' },
  joinBtn: { backgroundColor: '#6366F1' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { marginHorizontal: 12, color: '#888', fontSize: 14 },
  codeCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 24, elevation: 2 },
  codeLabel: { fontSize: 13, color: '#888', marginBottom: 8 },
  code: { fontSize: 36, fontWeight: '700', letterSpacing: 6, color: '#22C55E', marginBottom: 16 },
  shareBtn: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  shareBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  memberCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  memberAvatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  memberName: { fontSize: 15, color: '#111', fontWeight: '500' },
  leaveBtn: { marginTop: 24, marginBottom: 40, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#EF4444', alignItems: 'center' },
  leaveBtnText: { color: '#EF4444', fontSize: 15, fontWeight: '600' }
})