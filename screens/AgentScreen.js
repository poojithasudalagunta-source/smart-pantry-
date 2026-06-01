import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../lib/LanguageContext'
import {
  getExpiringItems,
  getExpiredItems,
  calculateWasteRisk,
  createWastePlan,
  
} from '../services/tools'
import {
  getPriorityItems,
  getPriorityIngredientNames,
} from '../services/recommendationService'

export default function AgentScreen() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pantryItems, setPantryItems] = useState([])
  const [mealMissingItems, setMealMissingItems] =
  useState([])
  const [expiringItems, setExpiringItems] = useState([])
  const flatListRef = useRef(null)
  const { language } = useLanguage()

  useEffect(() => {
    fetchPantryData()
  }, [])

  const fetchPantryData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    

    const { data: memberRows } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', session.user.id)

    let query = supabase.from('pantry_items').select('*')

    if (memberRows && memberRows.length > 0) {
      query = query.eq('household_id', memberRows[0].household_id)
    } else {
      query = query.eq('user_id', session.user.id)
    }

    const { data } = await query
    const items = data || []
    setPantryItems(items)

console.log(
  'Priority Items:',
  getPriorityItems(items)
)
    const wastePlan = createWastePlan(items)
    

if (wastePlan.risk !== 'LOW') {
  setMessages([
    {
      id: '0',
      role: 'agent',
      text: `🎯 Goal: Reduce Food Waste

⚠ Waste Risk: ${wastePlan.risk}

📦 Expiring Soon:
${wastePlan.expiringItems
  .map(i => `• ${i.name}`)
  .join('\n')}

🚀 Suggested Action:
Generate recipes using these ingredients today.`,
    },
  ])
}
    

    const expiring = items.filter(item => {
      if (!item.expiry_date) return false
      const days = Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
      return days <= 3 && days >= 0
    })
    setExpiringItems(expiring)

    const greeting = generateGreeting(items, expiring)
    setMessages(prev => [
  ...prev,
  {
    id: '1',
    role: 'agent',
    text: greeting,
  },
])
  }

  const generateGreeting = (items, expiring) => {
    const expired = items.filter(item => {
      if (!item.expiry_date) return false
      const days = Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
      return days < 0
    })

    if (language === 'te') {
      let msg = `నమస్కారం! 👋 నేను మీ స్మార్ట్ పాంట్రీ అసిస్టెంట్.\n\n`
      msg += `📦 మీ పాంట్రీలో ${items.length} వస్తువులు ఉన్నాయి.\n`
      if (expiring.length > 0) msg += `⚠️ ${expiring.length} వస్తువులు త్వరలో గడువు మించుతాయి!\n`
      if (expired.length > 0) msg += `❌ ${expired.length} వస్తువులు గడువు మించిపోయాయి!\n`
      msg += `\nనేను మీకు ఏమి సహాయం చేయగలను?`
      return msg
    } else {
      let msg = `Good day! 👋 I'm your Smart Pantry Agent.\n\n`
      msg += `📦 You have ${items.length} items in your pantry.\n`
      if (expiring.length > 0) msg += `⚠️ ${expiring.length} items are expiring soon!\n`
      if (expired.length > 0) msg += `❌ ${expired.length} items have already expired!\n`
      msg += `\nHow can I help you today?`
      return msg
    }
  }

  const buildSystemPrompt = () => {
    const itemsList = pantryItems.map(i => {
      const days = i.expiry_date
        ? Math.ceil((new Date(i.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
        : null
      return `${i.name} (qty: ${i.quantity} ${i.unit || 'pcs'}${days !== null ? `, expires in ${days} days` : ''})`
    }).join('\n')

    return `You are an intelligent AI Pantry Manager Agent for an Indian household app called SmartPantry.

Your goals are:
1. Minimize food waste
2. Save money for the family
3. Suggest recipes using available ingredients
4. Alert about expiring items
5. Generate smart shopping lists
6. Suggest donating excess food
7. Learn and adapt to user eating habits

Current pantry inventory:
${itemsList || 'No items in pantry yet'}

Expiring soon (within 3 days): ${expiringItems.map(i => i.name).join(', ') || 'None'}

Guidelines:
- Be conversational, warm and helpful like a family member
- Give specific actionable advice
- For Indian households, suggest Indian recipes
- Keep responses concise but helpful
- Always prioritize using items that expire soonest
- Suggest donation when items are in excess (qty > 5)
- When suggesting recipes, use items from the pantry
- When generating shopping list, consider what's already in pantry
${language === 'te' ? '- Always respond in Telugu language' : '- Respond in English'}`
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = { id: Date.now().toString(), role: 'user', text: input.trim() }
    setMessages(prev => [...prev, userMessage])
    const currentInput = input.trim()
    setInput('')
    setLoading(true)

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role === 'agent' ? 'assistant' : 'user',
        content: m.text
      }))
      const lowerInput = currentInput.toLowerCase()

if (
  lowerInput.includes('expiring') ||
  lowerInput.includes('expiry') ||
  currentInput.includes('గడువు')
) {
  const expiring = getExpiringItems(pantryItems)

const risk = calculateWasteRisk(pantryItems)

const actionText = expiring
  .map(item => {
    const days = Math.ceil(
      (new Date(item.expiry_date) - new Date()) /
      (1000 * 60 * 60 * 24)
    )

    if (days <= 1) {
      return `• ${item.name}: Use today or tomorrow`
    }

    if (days <= 3) {
      return `• ${item.name}: Prioritize this week`
    }

    return `• ${item.name}: Monitor usage`
  })
  .join('\n')

const reply =
  expiring.length === 0
    ? '✅ No items are expiring soon. Waste risk is LOW.'
    : `🎯 Goal: Reduce food waste

⚠ Waste Risk: ${risk}

📦 Expiring Items:
${expiring.map(i => `• ${i.name}`).join('\n')}

🚀 Recommended Action:
${actionText}`
  setMessages(prev => [
    ...prev,
    {
      id: Date.now().toString(),
      role: 'agent',
      text: reply,
    },
  ])

  setLoading(false)
  return
}
if (
  lowerInput.includes('meal plan') ||
  lowerInput.includes('plan my meals') ||
  lowerInput.includes('plan meals') ||
  currentInput.includes('భోజన')
) {

  const expiring = getExpiringItems(pantryItems)

  const priorityItems =
    expiring.length > 0
      ? expiring
      : pantryItems.slice(0, 5)

  const ingredients = priorityItems
    .map(item => item.name)
    .join(', ')

  const planningPrompt = `
You are Ammamma AI.

Goal:
Reduce food waste.

Available pantry ingredients:
${ingredients}
Today's objective:
Reduce food waste while creating realistic household meals.
Create a JSON response only.

Format:

{
  "breakfast": "",
  "lunch": "",
  "dinner": "",
  "reason": "",
  "missingIngredients": []
}

Rules:

Breakfast:
- Light morning meal
- Toast, sandwich, omelette, coffee, tea, milk-based drinks
- Prefer dairy, bread, eggs, fruits and beverages
- Do not use seafood as the primary breakfast ingredient
- Avoid biryani, heavy curries, seafood-heavy meals

Lunch:
- Main meal
- Rice, curry, wraps, protein dishes are allowed

Dinner:
- Main meal
- Slightly lighter than lunch when possible

General:
- Prioritize ingredients expiring soon
- Suggest practical Indian home-cooked meals
- Avoid unrealistic combinations
- Include only ingredients NOT already available
- missingIngredients must be an array
- Return valid JSON only


${language === 'te'
  ? 'Use Telugu values.'
  : 'Use English values.'}
`

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:
          `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: planningPrompt,
          },
        ],
        max_tokens: 500,
      }),
    }
  )

  const data = await response.json()

  const aiResponse =
  data.choices?.[0]?.message?.content || ''
console.log('AI RESPONSE:', aiResponse)
let mealData

try {
  const cleanResponse = aiResponse
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim()

  mealData = JSON.parse(cleanResponse)
} catch (e) {
  console.log('JSON PARSE ERROR:', e)
  mealData = null
}

if (!mealData) {
  setMessages(prev => [
    ...prev,
    {
      id: Date.now().toString(),
      role: 'agent',
      text: 'Unable to generate meal plan.'
    }
  ])

  setLoading(false)
  return
}
setMealMissingItems(
  mealData.missingIngredients || []
)
 setMessages(prev => [
  ...prev,
  {
    id: Date.now().toString(),
    role: 'agent',
    text: `👵 Ammamma's Meal Plan

🥣 Breakfast:
${mealData.breakfast}

🍛 Lunch:
${mealData.lunch}

🌙 Dinner:
${mealData.dinner}

💡 Reason:
${mealData.reason}

🛒 Missing Ingredients:
${mealData.missingIngredients?.join(', ') || 'Nothing needed'}
`,
  },
])

  setLoading(false)
  return
}

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            ...conversationHistory,
            { role: 'user', content: currentInput }
          ],
          max_tokens: 500
        })
      })

      const data = await response.json()
      const agentReply = data.choices?.[0]?.message?.content ||
        (language === 'te' ? 'క్షమించండి, అర్థం కాలేదు.' : 'Sorry, I could not process that.')

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        text: agentReply
      }])
    } catch (e) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        text: language === 'te' ? 'క్షమించండి, ఏదో తప్పు జరిగింది.' : 'Sorry, something went wrong.'
      }])
    }

    setLoading(false)
    setTimeout(() => flatListRef.current?.scrollToEnd(), 100)
  }

  const quickActions = language === 'te' ? [
  'గడువు మించే వస్తువులు చూపించు',
  'వంటకాలు సూచించు',
  'ఈరోజు భోజన ప్రణాళిక తయారు చేయి',
  'షాపింగ్ లిస్ట్ తయారు చేయి',
  'ఆహారం వృధా తగ్గించే చిట్కాలు',
] : [
  "What's expiring soon?",
  'Suggest recipes for today',
  'Plan my meals today',
  'Generate my shopping list',
  'How to reduce food waste?',
]

  const renderMessage = ({ item }) => (
    <View style={[
      styles.messageBubble,
      item.role === 'user' ? styles.userBubble : styles.agentBubble
    ]}>
      {item.role === 'agent' && (
        <Text style={styles.agentLabel}>👵 Ammamma</Text>
      )}
      <Text style={[
        styles.messageText,
        item.role === 'user' ? styles.userText : styles.agentText
      ]}>
        {item.text}
      </Text>
    </View>
  )
const addMissingToShoppingList = async () => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) return

    const { data: memberRows } =
      await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', session.user.id)

    const householdId =
      memberRows?.[0]?.household_id || null

    const rows = mealMissingItems.map(
      ingredient => ({
        user_id: session.user.id,
        household_id: householdId,
        name: ingredient,
        bought: false,
      })
    )

    const { error } = await supabase
      .from('shopping_list')
      .insert(rows)

    if (!error) {
      alert(
        `✅ Added ${mealMissingItems.length} items to Shopping List`
      )
    }
  } catch (e) {
    console.log(e)
    alert('Failed to add items')
  }
}
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
       <Text style={styles.headerTitle}>
  👵 Ammamma
</Text>
        <Text style={styles.headerSubtitle}>
          Your Kitchen Companion
        </Text>
        <View
  style={{
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
  }}
>
  <Text
    style={{
      color: '#fff',
      fontSize: 18,
      fontWeight: '700',
    }}
  >
    {calculateWasteRisk(pantryItems) === 'HIGH'
      ? '😱 Panic Ammamma'
      : calculateWasteRisk(pantryItems) ===
        'MEDIUM'
      ? '😟 Concerned Ammamma'
      : '😊 Happy Ammamma'}
  </Text>

  <Text
    style={{
      color: '#D1FAE5',
      marginTop: 4,
    }}
  >
    {calculateWasteRisk(pantryItems) === 'HIGH'
      ? 'Too many ingredients need rescue!'
      : calculateWasteRisk(pantryItems) ===
        'MEDIUM'
      ? 'A few ingredients need attention.'
      : 'Kitchen is under control.'}
  </Text>
</View>
      </View>
      
<View style={styles.dashboardContainer}>

  <View style={styles.statCard}>
    <Text style={styles.statEmoji}>
      🔥
    </Text>

    <Text style={styles.statNumber}>
      {calculateWasteRisk(pantryItems)}
    </Text>

    <Text style={styles.statLabel}>
      Chaos Level
    </Text>
  </View>

  <View style={styles.statCard}>
    <Text style={styles.statEmoji}>
      📦
    </Text>

    <Text style={styles.statNumber}>
      {pantryItems.length}
    </Text>

    <Text style={styles.statLabel}>
      Ingredients
    </Text>
  </View>

  <View style={styles.statCard}>
    <Text style={styles.statEmoji}>
      ⏳
    </Text>

    <Text style={styles.statNumber}>
      {expiringItems.length}
    </Text>

    <Text style={styles.statLabel}>
      Rescue Queue
    </Text>
  </View>

</View>
<View style={styles.missionCard}>
  <Text style={styles.missionTitle}>
    🎯 Today's Mission
  </Text>

  <Text style={styles.missionText}>
    Rescue {expiringItems.length} ingredients
    before they become food waste.
  </Text>
</View>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {loading && (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color="#14532D" />
          <Text style={styles.typingText}>
            {language === 'te' ? 'అసిస్టెంట్ ఆలోచిస్తోంది...' : '👵 Ammamma is thinking...'}
          </Text>
        </View>
      )}

      <View style={styles.quickActionsRow}>
        {quickActions.map((action, i) => (
          <TouchableOpacity
            key={i}
            style={styles.quickBtn}
            onPress={() => {
              setInput(action)
            }}
          >
            <Text style={styles.quickBtnText}>{action}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {mealMissingItems.length > 0 && (
  <TouchableOpacity
    style={{
      backgroundColor: '#22C55E',
      margin: 12,
      padding: 14,
      borderRadius: 12,
      alignItems: 'center',
    }}
    onPress={addMissingToShoppingList}
  >
    <Text
      style={{
        color: '#fff',
        fontWeight: '600',
      }}
    >
      🛒 Add Missing Ingredients To Shopping List
    </Text>
  </TouchableOpacity>
)}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={language === 'te' ? 'మీ పాంట్రీ గురించి అడగండి...' : 'Ask about your pantry...'}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>📤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  dashboardContainer: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  paddingHorizontal: 12,
  marginTop: 12,
},

statCard: {
  backgroundColor: '#fff',
  width: '31%',
  borderRadius: 18,
  padding: 14,
  alignItems: 'center',
  elevation: 2,
},

statEmoji: {
  fontSize: 24,
},

statNumber: {
  fontSize: 28,
  fontWeight: '700',
  marginTop: 6,
},

statLabel: {
  fontSize: 11,
  color: '#6B7280',
  marginTop: 4,
},

missionCard: {
  backgroundColor: '#E8FDF0',
  margin: 12,
  borderRadius: 18,
  padding: 16,
},

missionTitle: {
  fontSize: 18,
  fontWeight: '700',
},

missionText: {
  marginTop: 6,
  color: '#374151',
},
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#22C55E', padding: 16, paddingTop: 20 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: '#D1FAE5', marginTop: 2 },
  messageList: { padding: 16, paddingBottom: 8 },
  messageBubble: { maxWidth: '85%', marginBottom: 12, borderRadius: 16, padding: 12 },
  agentBubble: { backgroundColor: '#fff', alignSelf: 'flex-start', borderBottomLeftRadius: 4, elevation: 1 },
  userBubble: { backgroundColor: '#22C55E', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  agentLabel: { fontSize: 11, color: '#22C55E', fontWeight: '600', marginBottom: 4 },
  messageText: { fontSize: 14, lineHeight: 20 },
  agentText: { color: '#111' },
  userText: { color: '#fff' },
  typingIndicator: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  typingText: { fontSize: 13, color: '#888' },
  quickActionsRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 6 },
  quickBtn: { backgroundColor: '#E8FDF0', borderWidth: 1, borderColor: '#22C55E', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  quickBtnText: { fontSize: 12, color: '#22C55E', fontWeight: '500' },
  
  inputRow: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  input: { flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, maxHeight: 80 },
  sendBtn: { backgroundColor: '#22C55E', borderRadius: 12, width: 48, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#D1FAE5' },
  sendBtnText: { fontSize: 18 }
})