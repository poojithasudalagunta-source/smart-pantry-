import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Linking } from 'react-native'
import { supabase } from '../lib/supabase'

export default function ShoppingScreen() {
  const [items, setItems] = useState([])
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchShoppingList()
  }, [])

  const fetchShoppingList = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  const addItem = async () => {
    if (!newItem.trim()) return
    const { data: { session } } = await supabase.auth.getSession()
    const { data, error } = await supabase
      .from('shopping_list')
      .insert({ user_id: session.user.id, name: newItem.trim(), bought: false })
      .select()
    if (!error) {
      setItems([data[0], ...items])
      setNewItem('')
    }
  }

  const toggleBought = async (id, bought) => {
    await supabase.from('shopping_list').update({ bought: !bought }).eq('id', id)
    setItems(items.map(i => i.id === id ? { ...i, bought: !bought } : i))
  }

  const deleteItem = async (id) => {
    await supabase.from('shopping_list').delete().eq('id', id)
    setItems(items.filter(i => i.id !== id))
  }

  const openBlinkit = (name) => {
    Linking.openURL(`https://blinkit.com/s/?q=${encodeURIComponent(name)}`)
  }

  const clearBought = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('shopping_list').delete().eq('user_id', session.user.id).eq('bought', true)
    setItems(items.filter(i => !i.bought))
  }

  const pending = items.filter(i => !i.bought)
  const bought = items.filter(i => i.bought)

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>🛒 Shopping List</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Add item..."
          value={newItem}
          onChangeText={setNewItem}
          onSubmitEditing={addItem}
        />
        <TouchableOpacity style={styles.addBtn} onPress={addItem}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.empty}>Loading...</Text>
      ) : items.length === 0 ? (
        <Text style={styles.empty}>No items yet! Add something to buy 🛍️</Text>
      ) : (
        <>
          {pending.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>To Buy ({pending.length})</Text>
              {pending.map(item => (
                <View key={item.id} style={styles.card}>
                  <TouchableOpacity onPress={() => toggleBought(item.id, item.bought)} style={styles.checkbox}>
                    <Text style={styles.checkboxText}>{item.bought ? '✅' : '⬜'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <TouchableOpacity onPress={() => openBlinkit(item.name)} style={styles.blinkitBtn}>
                    <Text style={styles.blinkitText}>🛵 Buy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.deleteBtn}>
                    <Text style={styles.deleteText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {bought.length > 0 && (
            <>
              <View style={styles.boughtHeader}>
                <Text style={styles.sectionTitle}>Bought ({bought.length})</Text>
                <TouchableOpacity onPress={clearBought}>
                  <Text style={styles.clearText}>Clear all</Text>
                </TouchableOpacity>
              </View>
              {bought.map(item => (
                <View key={item.id} style={[styles.card, styles.boughtCard]}>
                  <TouchableOpacity onPress={() => toggleBought(item.id, item.bought)} style={styles.checkbox}>
                    <Text style={styles.checkboxText}>✅</Text>
                  </TouchableOpacity>
                  <Text style={[styles.itemName, styles.boughtText]}>{item.name}</Text>
                  <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.deleteBtn}>
                    <Text style={styles.deleteText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  header: { fontSize: 24, fontWeight: '700', marginTop: 8, marginBottom: 16 },
  inputRow: { flexDirection: 'row', marginBottom: 20, gap: 8 },
  input: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 16 },
  addBtn: { backgroundColor: '#22C55E', borderRadius: 12, width: 50, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 24, fontWeight: '300' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  boughtCard: { opacity: 0.6 },
  checkbox: { marginRight: 10 },
  checkboxText: { fontSize: 18 },
  itemName: { flex: 1, fontSize: 15, color: '#111' },
  boughtText: { textDecorationLine: 'line-through', color: '#888' },
  blinkitBtn: { backgroundColor: '#F97316', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  blinkitText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  deleteBtn: { padding: 4 },
  deleteText: { fontSize: 16 },
  empty: { textAlign: 'center', color: '#888', marginTop: 60, fontSize: 15 },
  boughtHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  clearText: { color: '#EF4444', fontSize: 13, fontWeight: '600' }
})