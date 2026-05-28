import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { Camera } from 'expo-camera'
import { supabase } from '../lib/supabase'

const CATEGORIES = ['🥦 Vegetables', '🍎 Fruits', '🥛 Dairy', '🥩 Meat', '🌾 Grains', '🥫 Canned', '🧃 Drinks', '🍫 Snacks', '🧴 Other']

export default function AddItemScreen() {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('pcs')
  const [category, setCategory] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [fetchingProduct, setFetchingProduct] = useState(false)
 const [permission, setPermission] = useState(null)

  const handleBarcodeScan = async ({ data }) => {
    setScanning(false)
    setFetchingProduct(true)
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`)
      const json = await res.json()
      if (json.status === 1) {
        const product = json.product
        setName(product.product_name || product.abbreviated_product_name || '')
        setCategory(product.categories_tags?.[0]?.replace('en:', '') || '')
        alert(`✅ Found: ${product.product_name}`)
      } else {
        alert('Product not found in database. Please enter manually.')
      }
    } catch (e) {
      alert('Failed to fetch product info.')
    }
    setFetchingProduct(false)
  }

  const handleScanPress = async () => {
  const { status } = await Camera.requestCameraPermissionsAsync()
  if (status !== 'granted') return alert('Camera permission is required to scan barcodes.')
  setScanning(true)
}

  const handleAdd = async () => {
    if (!name.trim()) return alert('Please enter item name')
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('pantry_items').insert({
      user_id: user.id,
      name: name.trim(),
      quantity: parseInt(quantity) || 1,
      unit,
      category,
      expiry_date: expiryDate || null
    })
    if (error) alert(error.message)
    else {
      alert('Item added! ✅')
      setName('')
      setQuantity('1')
      setUnit('pcs')
      setCategory('')
      setExpiryDate('')
    }
    setLoading(false)
  }

  if (scanning) {
    return (
      <View style={styles.scanContainer}>
        <CameraView
          style={styles.camera}
          onBarcodeScanned={handleBarcodeScan}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
        />
        <View style={styles.scanOverlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanText}>Point camera at barcode</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setScanning(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>➕ Add Item</Text>

      <TouchableOpacity style={styles.scanBtn} onPress={handleScanPress}>
        <Text style={styles.scanBtnText}>📷 Scan Barcode</Text>
      </TouchableOpacity>

      {fetchingProduct && <ActivityIndicator color="#22C55E" style={{ marginVertical: 10 }} />}

      <Text style={styles.label}>Item Name *</Text>
      <TextInput style={styles.input} placeholder="e.g. Tomatoes" value={name} onChangeText={setName} />

      <Text style={styles.label}>Quantity</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} placeholder="1" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="pcs / kg / L" value={unit} onChangeText={setUnit} />
      </View>

      <Text style={styles.label}>Expiry Date (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} placeholder="e.g. 2026-06-15" value={expiryDate} onChangeText={setExpiryDate} />

      <Text style={styles.label}>Category</Text>
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
        <Text style={styles.buttonText}>{loading ? 'Adding...' : 'Add to Pantry'}</Text>
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
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  scanContainer: { flex: 1 },
  camera: { flex: 1 },
  scanOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: '#22C55E', borderRadius: 12, backgroundColor: 'transparent' },
  scanText: { color: '#fff', fontSize: 16, marginTop: 20, fontWeight: '600' },
  cancelBtn: { marginTop: 20, backgroundColor: '#EF4444', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  cancelText: { color: '#fff', fontSize: 16, fontWeight: '600' }
})