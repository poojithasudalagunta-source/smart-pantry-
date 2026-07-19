import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native'

import * as ImagePicker from 'expo-image-picker'
import Tesseract from 'tesseract.js'

import { supabase } from '../lib/supabase'

export default function BillScannerScreen() {
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')
  const [items, setItems] = useState([])

  const pickImage = async () => {
    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes:
          ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      })

    if (!result.canceled) {
      setImage(result.assets[0].uri)
      scanBill(result.assets[0].uri)
    }
  }

  const stripCodeFences = text =>
    String(text || '')
      .replace(/^```json\s*/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim()

  const parseRecoveredItems = text => {
    const clean = stripCodeFences(text)
    const start = clean.indexOf('[')
    const end = clean.lastIndexOf(']')

    if (start === -1 || end === -1 || end < start) {
      return { items: [], truncated: true }
    }

    const body = clean.slice(start + 1, end)
    const recovered = []
    let index = 0
    let truncated = false

    while (index < body.length) {
      while (index < body.length && /[\s,]/.test(body[index])) {
        index += 1
      }

      const objectStart = body.indexOf('{', index)
      if (objectStart === -1) break

      let depth = 0
      let inString = false
      let escaped = false
      let objectEnd = -1

      for (let i = objectStart; i < body.length; i += 1) {
        const char = body[i]

        if (escaped) {
          escaped = false
          continue
        }

        if (char === '\\') {
          escaped = true
          continue
        }

        if (char === '"') {
          inString = !inString
          continue
        }

        if (inString) {
          continue
        }

        if (char === '{') {
          depth += 1
        } else if (char === '}') {
          depth -= 1
          if (depth === 0) {
            objectEnd = i
            break
          }
        }
      }

      if (objectEnd === -1) {
        truncated = true
        break
      }

      const candidate = body.slice(objectStart, objectEnd + 1)

      try {
        const parsedObject = JSON.parse(candidate)
        if (parsedObject && typeof parsedObject === 'object' && !Array.isArray(parsedObject)) {
          recovered.push(parsedObject)
          index = objectEnd + 1
        } else {
          index = objectEnd + 1
        }
      } catch (e) {
        truncated = true
        break
      }
    }

    return {
      items: recovered,
      truncated,
    }
  }

  const getExpiryDays = item => {
    const name = String(item?.name || '').toLowerCase().trim()
    const category = String(item?.category || '').toLowerCase().trim()

    if (name.includes('milk') || name.includes('curd') || name.includes('yogurt') || name.includes('paneer')) {
      return 7
    }

    if (name.includes('bread') || name.includes('bun') || name.includes('toast') || name.includes('bun')) {
      return 5
    }

    if (name.includes('egg')) {
      return 14
    }

    if (name.includes('banana') || name.includes('apple') || name.includes('orange') || name.includes('grapes') || name.includes('mango')) {
      return 7
    }

    if (name.includes('tomato') || name.includes('onion') || name.includes('potato') || name.includes('carrot') || name.includes('cucumber') || name.includes('capsicum')) {
      return 10
    }

    if (name.includes('rice') || name.includes('dal') || name.includes('lentil') || name.includes('chana') || name.includes('moong') || name.includes('masoor')) {
      return 180
    }

    if (category.includes('dairy')) {
      return 7
    }

    if (category.includes('bakery')) {
      return 5
    }

    if (category.includes('fruit')) {
      return 7
    }

    if (category.includes('vegetable')) {
      return 10
    }

    if (category.includes('grain')) {
      return 180
    }

    if (category.includes('frozen')) {
      return 30
    }

    return 7
  }

  const scanBill = async imageUri => {
    try {
      setLoading(true)
      setItems([])

      // STEP 1
      setLoadingText('📸 Reading bill...')

      const ocrResult = await Tesseract.recognize(
        imageUri,
        'eng'
      )

      const extractedText = ocrResult.data.text

      console.log('OCR TEXT:', extractedText)

      // STEP 2
      setLoadingText('🤖 AI understanding items...')

      const prompt = `
Extract ONLY edible grocery food items from this bill.

Rules:
- Include ONLY food items
- Ignore alcohol
- Ignore cigarettes
- Ignore medicine
- Ignore cleaning products
- Ignore household products
- Ignore unclear OCR text
- Ignore random words
- Ignore non-food products
- Only include items if confidence is high
- Return ONLY valid JSON array
- Do not use code fences
- Do not include explanations
- Do not include expiry_days
- Each item must be a JSON object with exactly these fields: name, quantity, unit, category

Format:
[
  {
    "name": "milk",
    "quantity": 1,
    "unit": "pcs",
    "category": "Dairy"
  }
]

Possible categories:
- Vegetables
- Fruits
- Dairy
- Snacks
- Beverages
- Grains
- Bakery
- Frozen
- General

Bill text:
${extractedText}
`

      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: 1800,
          }),
        }
      )

      const data = await response.json()

      const text =
        data.choices?.[0]?.message?.content || ''
      console.log('OCR LENGTH:', extractedText.length)
      console.log('AI RESPONSE LENGTH:', text.length)
      console.log('MAX_TOKENS USED:', 1800)

      const parsedResult = parseRecoveredItems(text)
      const parsedItems = Array.isArray(parsedResult.items) ? parsedResult.items : []
      const truncatedResponse = parsedResult.truncated
      console.log('PARSED ITEMS COUNT:', parsedItems.length)
      console.log('TRUNCATED RESPONSE DETECTED:', truncatedResponse)

      const normalizedItems = parsedItems
        .filter(item => item && typeof item === 'object' && item.name)
        .map(item => ({
          ...item,
          name: String(item.name).trim(),
          quantity: Number(item.quantity || 1),
          unit: item.unit || 'pcs',
          category: item.category || 'General',
          expiry_days: getExpiryDays(item),
        }))

      const uniqueItems = normalizedItems.filter(
        (item, index, self) =>
          index ===
          self.findIndex(
            i =>
              i.name?.toLowerCase() ===
              item.name?.toLowerCase()
          )
      )

      console.log('RECOVERED ITEMS COUNT:', uniqueItems.length)

      if (uniqueItems.length === 0) {
        alert('Invalid AI response')
        setLoading(false)
        return
      }

      setItems(uniqueItems)

      // STEP 3
      setLoadingText('📦 Adding items to pantry...')

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        alert('Please login again')
        return
      }

      const { data: memberRows } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', session.user.id)

      const householdId =
        memberRows?.[0]?.household_id || null

      let addedCount = 0
      let updatedCount = 0

      for (const item of uniqueItems) {
        // Calculate expiry date
        let expiryDate = null

        if (item.expiry_days) {
          const date = new Date()

          date.setDate(
            date.getDate() + item.expiry_days
          )

          expiryDate = date
            .toISOString()
            .split('T')[0]
        }

        // Check if item already exists
        let existingQuery = supabase
          .from('pantry_items')
          .select('*')
          .ilike('name', item.name)

        if (householdId) {
          existingQuery = existingQuery.eq(
            'household_id',
            householdId
          )
        } else {
          existingQuery = existingQuery.eq(
            'user_id',
            session.user.id
          )
        }

        const { data: existingItems } =
          await existingQuery

        // UPDATE existing item
        if (
          existingItems &&
          existingItems.length > 0
        ) {
          const existing = existingItems[0]

          const newQuantity =
            Number(existing.quantity || 0) +
            Number(item.quantity || 1)

          await supabase
            .from('pantry_items')
            .update({
              quantity: newQuantity,
            })
            .eq('id', existing.id)

          updatedCount++
        }

        // INSERT new item
        else {
          await supabase
            .from('pantry_items')
            .insert({
              user_id: session.user.id,
              household_id: householdId,
              name: item.name,
              quantity: item.quantity || 1,
              unit: item.unit || 'pcs',
              expiry_date: expiryDate,
              category:
                item.category || 'General',
            })

          addedCount++
        }
      }

      alert(
        `🎉 Scan Complete!\n\n✅ Added: ${addedCount} items\n🔄 Updated: ${updatedCount} items\n📅 Expiry dates predicted`
      )
    } catch (e) {
      console.log(e)
      alert('Failed to scan bill')
    }

    setLoading(false)
    setLoadingText('')
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>
        📸 Scan Grocery Bill
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={pickImage}
      >
        <Text style={styles.buttonText}>
          Choose Bill Photo
        </Text>
      </TouchableOpacity>

      {image && (
        <Image
          source={{ uri: image }}
          style={styles.image}
        />
      )}

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator
            size="large"
            color="#22C55E"
          />

          <Text style={styles.loadingText}>
            {loadingText}
          </Text>
        </View>
      )}

      {items.length > 0 && (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>
            Extracted Items
          </Text>

          {items.map((item, index) => (
            <View
              key={index}
              style={styles.itemCard}
            >
              <Text style={styles.item}>
                ✅ {item.name}
              </Text>

              <Text style={styles.itemDetails}>
                {item.quantity} {item.unit} •{' '}
                {item.category}
              </Text>

              {item.expiry_days && (
                <Text style={styles.expiry}>
                  📅 Expires in{' '}
                  {item.expiry_days} days
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
  },

  header: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    marginTop: 8,
  },

  button: {
    backgroundColor: '#22C55E',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  image: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    marginTop: 20,
  },

  loadingBox: {
    marginTop: 30,
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#555',
    fontWeight: '500',
  },

  resultBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 30,
  },

  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },

  itemCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },

  item: {
    fontSize: 15,
    fontWeight: '600',
  },

  itemDetails: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },

  expiry: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
})