import { useState, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../lib/LanguageContext'

export default function HomeScreen() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [isHousehold, setIsHousehold] = useState(false)
  const { t, language, setLanguage } = useLanguage()

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: memberRows } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', session.user.id)

      let query = supabase
        .from('pantry_items')
        .select('*')
        .order('expiry_date', { ascending: true })

      if (memberRows && memberRows.length > 0) {
        setIsHousehold(true)
        query = query.eq('household_id', memberRows[0].household_id)
      } else {
        setIsHousehold(false)
        query = query.eq('user_id', session.user.id)
      }

      const { data, error } = await query
      if (error) alert(error.message)
      else setItems(data || [])
    } catch (e) {
      alert('Failed to load items')
    } finally {
      setLoading(false)
    }
  }

  const deleteItem = async (id) => {
    const { error } = await supabase.from('pantry_items').delete().eq('id', id)
    if (!error) setItems(items.filter(item => item.id !== id))
  }

  const getExpiryColor = (expiryDate) => {
    if (!expiryDate) return '#888'
    const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
    if (days <= 2) return '#EF4444'
    if (days <= 7) return '#F97316'
    return '#22C55E'
  }

  const getExpiryText = (expiryDate) => {
    if (!expiryDate) return t.noExpiry
    const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
    if (days < 0) return t.expired
    if (days === 0) return t.expiringToday
    if (days === 1) return t.expiringTomorrow
    return `${t.expiresIn} ${days} ${language === 'te' ? 'రోజులు' : 'days'}`
  }

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={[styles.expiryBar, { backgroundColor: getExpiryColor(item.expiry_date) }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardLeft}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemMeta}>{item.quantity} {item.unit || 'pcs'} • {item.category || 'General'}</Text>
          <Text style={[styles.expiryText, { color: getExpiryColor(item.expiry_date) }]}>
            {getExpiryText(item.expiry_date)}
          </Text>
        </View>
        <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>🥦 {t.pantry}</Text>
          {isHousehold && <Text style={styles.householdBadge}>👨‍👩‍👧 {language === 'te' ? 'గృహ పాంట్రీ' : 'Household pantry'}</Text>}
        </View>
        <View style={styles.headerRight}>
          <View style={styles.langToggle}>
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
          <TouchableOpacity onPress={async () => {
            await supabase.auth.signOut()
            setItems([])
          }}>
            <Text style={styles.logout}>{t.logout}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {loading ? (
        <Text style={styles.empty}>{t.loading}</Text>
      ) : items.length === 0 ? (
        <Text style={styles.empty}>{t.noItems}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  header: { fontSize: 24, fontWeight: '700' },
  householdBadge: { fontSize: 12, color: '#22C55E', fontWeight: '500', marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, flexDirection: 'row', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  expiryBar: { width: 5 },
  cardContent: { flex: 1, flexDirection: 'row', padding: 14, alignItems: 'center' },
  cardLeft: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: '#111' },
  itemMeta: { fontSize: 13, color: '#888', marginTop: 2 },
  expiryText: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  deleteBtn: { padding: 8 },
  deleteText: { fontSize: 18 },
  empty: { textAlign: 'center', color: '#888', marginTop: 60, fontSize: 15 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  langToggle: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 8, padding: 2 },
  langBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  langBtnActive: { backgroundColor: '#22C55E' },
  langText: { fontSize: 12, fontWeight: '600', color: '#888' },
  langTextActive: { color: '#fff' },
  logout: { color: '#EF4444', fontSize: 14, fontWeight: '600' }
})