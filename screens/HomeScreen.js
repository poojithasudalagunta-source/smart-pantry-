import { useState, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { supabase } from '../lib/supabase'

export default function HomeScreen() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('user_id', session.user.id)
        .order('expiry_date', { ascending: true })
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
    if (!expiryDate) return 'No expiry'
    const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
    if (days < 0) return 'Expired!'
    if (days === 0) return 'Expires today!'
    if (days === 1) return 'Expires tomorrow!'
    return `Expires in ${days} days`
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
        <Text style={styles.header}>🥦 My Pantry</Text>
        <TouchableOpacity onPress={async () => {
          await supabase.auth.signOut()
          setItems([])
        }}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <Text style={styles.empty}>Loading...</Text>
      ) : items.length === 0 ? (
        <Text style={styles.empty}>No items yet! Tap ➕ to add some.</Text>
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
  logout: { color: '#EF4444', fontSize: 14, fontWeight: '600' }
})