import { useState, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native'
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
  const getCategoryEmoji = (category) => {
  switch ((category || '').toLowerCase()) {
    case 'dairy':
      return '🥛'

    case 'beverages':
      return '🥤'

    case 'vegetables':
      return '🥦'

    case 'fruits':
      return '🍎'

    case 'meat':
      return '🍗'

    default:
      return '📦'
  }
}
  
  const renderItem = ({ item }) => (
  <View style={styles.card}>
    <View
      style={[
        styles.expiryBar,
        { backgroundColor: getExpiryColor(item.expiry_date) },
      ]}
    />

    <View style={styles.cardContent}>
      <View style={styles.foodIconContainer}>
        <Text style={styles.foodIcon}>
          {getCategoryEmoji(item.category)}
        </Text>
      </View>

      <View style={styles.cardLeft}>
        <Text style={styles.itemName}>
          {item.name}
        </Text>

        <Text style={styles.itemMeta}>
          Qty: {item.quantity || 1}
        </Text>

        <Text style={styles.itemMeta}>
          {item.category || 'General'}
        </Text>

        <Text
          style={[
            styles.expiryText,
            { color: getExpiryColor(item.expiry_date) },
          ]}
        >
          {getExpiryText(item.expiry_date)}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => deleteItem(item.id)}
        style={styles.deleteBtn}
      >
        <Text style={styles.deleteText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  </View>
)
  const expiringCount = items.filter(item => {
  if (!item.expiry_date) return false

  const days = Math.ceil(
    (new Date(item.expiry_date) - new Date()) /
      (1000 * 60 * 60 * 24)
  )

  return days >= 0 && days <= 3
}).length

const expiredCount = items.filter(item => {
  if (!item.expiry_date) return false

  const days = Math.ceil(
    (new Date(item.expiry_date) - new Date()) /
      (1000 * 60 * 60 * 24)
  )

  return days < 0
}).length
console.log('HomeScreen rendering')
const pantryHealth =
  items.length === 0
    ? 100
    : Math.max(
        0,
        Math.round(
          ((items.length - expiredCount) / items.length) * 100
        )
      )
const hour = new Date().getHours()

let greeting = 'Good Evening'

if (hour < 12) greeting = 'Good Morning'
else if (hour < 17) greeting = 'Good Afternoon'


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
<View style={styles.heroCard}>
  <View style={styles.heroLeft}>
    <Text style={styles.heroTitle}>
  👋 {greeting}
</Text>
<Text style={styles.heroSubtitle}>
  Track food before it becomes waste.
</Text>

<Text style={styles.healthText}>
  💚 {pantryHealth}% Pantry Health
</Text>
    
    

    <View style={styles.updatedBadge}>
      <Text style={styles.updatedText}>
        🕒 Last updated: Just now
      </Text>
    </View>
  </View>

  <View style={styles.heroRight}>
    
    <Image
  source={require('../assets/images/pantry-health.png')}
  style={styles.healthImage}
  resizeMode="contain"
/>
  </View>
</View>
<View
  style={{
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  }}
>
  <View style={[styles.statCard, styles.ingredientsCard]}>
  <Text style={styles.statIcon}>📦</Text>

  <Text style={styles.statValue}>
    {items.length}
  </Text>

  <Text style={styles.statLabel}>
    Ingredients
  </Text>
</View>

  <View style={[styles.statCard, styles.expiringCard]}>
  <Text style={styles.statIcon}>⏳</Text>

  <Text style={styles.statValue}>
    {expiringCount}
  </Text>

  <Text style={styles.statLabel}>
    Expiring
  </Text>
</View>

  <View style={[styles.statCard, styles.expiredCard]}>
  <Text style={styles.statIcon}>❌</Text>

  <Text style={styles.statValue}>
    {expiredCount}
  </Text>

  <Text style={styles.statLabel}>
    Expired
  </Text>
</View>
</View>
<View style={styles.quickActions}>
  <Text style={styles.quickTitle}>
    Quick Actions
  </Text>
</View>
<View style={styles.quickGrid}>
    <TouchableOpacity style={styles.actionCard}>
      <Text style={styles.actionIcon}>➕</Text>
      <Text style={styles.actionText}>Add Item</Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.actionCard}>
      <Text style={styles.actionIcon}>📷</Text>
      <Text style={styles.actionText}>Scan Bill</Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.actionCard}>
      <Text style={styles.actionIcon}>🍳</Text>
      <Text style={styles.actionText}>Recipes</Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.actionCard}>
      <Text style={styles.actionIcon}>🛒</Text>
      <Text style={styles.actionText}>Shopping</Text>
    </TouchableOpacity>
  </View>
  <View style={styles.sectionHeader}>
  <Text style={styles.sectionTitle}>
    Expiring Soon
  </Text>

  <TouchableOpacity>
    <Text style={styles.viewAll}>
      View All →
    </Text>
  </TouchableOpacity>
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
  heroCard: {
  backgroundColor: '#0B7A43',
  borderRadius: 28,
  paddingVertical: 6,
  minHeight: 120,
paddingHorizontal: 24,
  marginBottom: 20,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

heroLeft: {
  flex: 1,
},

heroTitle: {
  color: '#fff',
  fontSize: 22,
  fontWeight: '700',
},

heroSubtitle: {
  color: '#D1FAE5',
  marginTop: 10,
  fontSize: 16,
},

updatedBadge: {
  marginTop: 20,
  backgroundColor: 'rgba(255,255,255,0.15)',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 20,
  alignSelf: 'flex-start',
},

updatedText: {
  color: '#fff',
  fontSize: 13,
},
heroRight: {
  justifyContent: 'center',
  alignItems: 'center',
},


groceryImage: {
  width: 70,
  height: 70,
},
healthImage: {
  width: 75,
  height: 75,
},

  statCard: {
  backgroundColor: '#fff',
  width: '31%',
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderRadius: 18,
  alignItems: 'center',
},

statValue: {
  fontSize: 18,
  fontWeight: '700',
},

statIcon: {
  fontSize: 24,
  marginBottom: 8,
},

statLabel: {
  color: '#6B7280',
  marginTop: 4,
},

ingredientsCard: {
  backgroundColor: '#ECFDF5',
},

expiringCard: {
  backgroundColor: '#FFF7ED',
},

expiredCard: {
  backgroundColor: '#FEF2F2',
},

  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  header: { fontSize: 24, fontWeight: '700' },
  householdBadge: { fontSize: 12, color: '#22C55E', fontWeight: '500', marginTop: 2 },
 card: {
  backgroundColor: '#fff',
  borderRadius: 18,
  marginBottom: 12,
  flexDirection: 'row',
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: '#E5E7EB',
},
  expiryBar: { width: 5 },
  cardContent: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  padding: 14,
},
  cardLeft: {
  flex: 1,
},
  itemName: {
  fontSize: 18,
  fontWeight: '700',
  color: '#111827',
},
  itemMeta: {
  fontSize: 13,
  color: '#6B7280',
  marginTop: 2,
},
  expiryText: {
  marginTop: 6,
  fontSize: 13,
  fontWeight: '600',
},
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
  logout: { color: '#EF4444', fontSize: 14, fontWeight: '600' },

  quickActions: {
  marginBottom: 20,
},

quickTitle: {
  fontSize: 18,
  fontWeight: '700',
  marginBottom: 12,
},

quickGrid: {
  flexDirection: 'row',
  justifyContent: 'space-between',
},

actionCard: {
  backgroundColor: '#fff',
  width: '23%',
  paddingVertical: 12,
  paddingHorizontal: 8,
  borderRadius: 20,
  alignItems: 'center',
},

actionIcon: {
  fontSize: 22,
  marginBottom: 8,
},


actionText: {
  fontSize: 14,
  fontWeight: '600',
},
sectionHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
  marginTop: 10,
},

sectionTitle: {
  fontSize: 18,
  fontWeight: '700',
},

viewAll: {
  color: '#16A34A',
  fontWeight: '600',
},
healthText: {
  color: '#fff',
  fontSize: 18,
  fontWeight: '700',
  marginTop: 10,
},
foodIconContainer: {
  width: 60,
  height: 60,
  borderRadius: 30,
  backgroundColor: '#F3F4F6',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 12,
},

foodIcon: {
  fontSize: 28,
}
})