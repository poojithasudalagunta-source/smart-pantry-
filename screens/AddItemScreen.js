import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../lib/LanguageContext'

const CATEGORIES_EN = ['🥦 Vegetables', '🍎 Fruits', '🥛 Dairy', '🥩 Meat', '🌾 Grains', '🥫 Canned', '🧃 Drinks', '🍫 Snacks', '🧴 Other']
const CATEGORIES_TE = ['🥦 కూరగాయలు', '🍎 పండ్లు', '🥛 పాల ఉత్పత్తులు', '🥩 మాంసం', '🌾 ధాన్యాలు', '🥫 డబ్బాలు', '🧃 పానీయాలు', '🍫 స్నాక్స్', '🧴 ఇతరాలు']

export default function AddItemScreen() {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('pcs')
  const [category, setCategory] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [loading, setLoading] = useState(false)
  const { t, language } = useLanguage()

  const CATEGORIES = language === 'te' ? CATEGORIES_TE : CATEGORIES_EN

  const handleScanPress = () => {
    alert(language === 'te' ? '📷 బార్కోడ్ స్కానింగ్ త్వరలో వస్తుంది!' : '📷 Barcode scanning coming soon on mobile!')
  }

  const handleAdd = async () => {
    if (!name.trim()) return alert(language === 'te' ? 'దయచేసి వస్తువు పేరు నమోదు చేయండి' : 'Please enter item name')
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()

    const { data: memberRows } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', session.user.id)

    const householdId = memberRows?.[0]?.household_id || null

    const { error } = await supabase.from('pantry_items').insert({
      user_id: session.user.id,
      household_id: householdId,
      name: name.trim(),
      quantity: parseInt(quantity) || 1,
      unit,
      category,
      expiry_date: expiryDate || null
    })

    if (error) alert(error.message)
    else {
      alert(language === 'te' ? 'వస్తువు జోడించబడింది! ✅' : 'Item added! ✅')
      setName('')
      setQuantity('1')
      setUnit('pcs')
      setCategory('')
      setExpiryDate('')
    }
    setLoading(false)
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>➕ {t.addItem}</Text>

      <TouchableOpacity style={styles.scanBtn} onPress={handleScanPress}>
        <Text style={styles.scanBtnText}>📷 {t.scanBarcode}</Text>
      </TouchableOpacity>

      <Text style={styles.label}>{t.itemName} *</Text>
      <TextInput
        style={styles.input}
        placeholder={language === 'te' ? 'ఉదా: టమాటాలు' : 'e.g. Tomatoes'}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>{t.quantity}</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1, marginRight: 8 }]}
          placeholder="1"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder={language === 'te' ? 'పీస్ / కిలో / లీ' : 'pcs / kg / L'}
          value={unit}
          onChangeText={setUnit}
        />
      </View>

      <Text style={styles.label}>{t.expiryDate} (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        placeholder={language === 'te' ? 'ఉదా: 2026-06-15' : 'e.g. 2026-06-15'}
        value={expiryDate}
        onChangeText={setExpiryDate}
      />

      <Text style={styles.label}>{t.category}</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.catBtn, category === cat && styles.catBtnActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleAdd} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading
            ? (language === 'te' ? 'జోడిస్తోంది...' : 'Adding...')
            : t.addToPantryBtn}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  header: { fontSize: 24, fontWeight: '700', marginBottom: 20, marginTop: 8 },
  scanBtn: { backgroundColor: '#111', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  scanBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 16 },
  row: { flexDirection: 'row' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  catBtnActive: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  catText: { fontSize: 13, color: '#374151' },
  catTextActive: { color: '#fff' },
  button: { backgroundColor: '#22C55E', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' }
})