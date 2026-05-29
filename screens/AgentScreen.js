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


export default function AgentScreen() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pantryItems, setPantryItems] = useState([])
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
    setPantryItems(items)

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
    'షాపింగ్ లిస్ట్ తయారు చేయి',
    'ఆహారం వృధా తగ్గించే చిట్కాలు',
  ] : [
    "What's expiring soon?",
    'Suggest recipes for today',
    'Generate my shopping list',
    'How to reduce food waste?',
  ]

  const renderMessage = ({ item }) => (
    <View style={[
      styles.messageBubble,
      item.role === 'user' ? styles.userBubble : styles.agentBubble
    ]}>
      {item.role === 'agent' && (
        <Text style={styles.agentLabel}>🤖 Agent</Text>
      )}
      <Text style={[
        styles.messageText,
        item.role === 'user' ? styles.userText : styles.agentText
      ]}>
        {item.text}
      </Text>
    </View>
  )

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          🤖 {language === 'te' ? 'పాంట్రీ అసిస్టెంట్' : 'Pantry Agent'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {language === 'te' ? 'AI ద్వారా ఆహారం వృధా తగ్గించండి' : 'AI-powered food waste reduction'}
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
          <ActivityIndicator size="small" color="#22C55E" />
          <Text style={styles.typingText}>
            {language === 'te' ? 'అసిస్టెంట్ ఆలోచిస్తోంది...' : 'Agent is thinking...'}
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