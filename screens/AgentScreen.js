import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../lib/LanguageContext'
import {
  getExpiredItems,
  calculateWasteRisk,
  createWastePlan,
  
} from '../services/tools'
import {
  getPriorityItems,
} from '../services/recommendationService'

import { createPlan } from "../services/agent/plannerService";
import { executePlan } from "../services/agent/toolExecutor";
import { buildContext } from "../services/agent/contextBuilder";
import { requestGroqChat } from '../services/agent/groqClient'
import { AGENT_INTENTS } from '../services/agent/intentConstants'
import { generateExpiryResponse } from '../services/expiryService'
import { generateMealPlanResponse } from '../services/mealPlannerService'
import { generateShoppingListResponse } from '../services/shoppingService'
export default function AgentScreen() {
  const DEBUG_AGENT = __DEV__
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
    

    const expiring = wastePlan.expiringItems
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
    const expired = getExpiredItems(items)

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

  const buildSystemPrompt = (context) => {
  return `
You are Ammamma AI, an intelligent pantry assistant for an Indian household.

========================
CURRENT CONTEXT
========================

${context}

========================

Rules:
- Be warm and conversational like a family member.
- Always prioritize ingredients that expire soon.
- Suggest practical Indian recipes.
- Help reduce food waste.
- Generate shopping lists only when needed.
- Keep responses concise and actionable.
${language === 'te'
  ? '- Always respond in Telugu.'
  : '- Always respond in English.'}
`;
}

  const appendAgentMessage = (text) => {
    setMessages(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: 'agent',
      text,
    }])
  }

  const logAgentFlow = (plan, toolResults, timings = {}) => {
    console.log('🧠 Planner')
    console.log('Intent:', plan.intent)
    console.log('Confidence:', plan.confidence)
    console.log('Reason:', plan.reason)
    console.log('Planner:', `${timings.plannerMs || 0} ms`)
    console.log('------------------------')
    console.log('🔧 Executor')
    ;(toolResults.executedTools || []).forEach(tool => {
      console.log(`✓ ${tool}`, `${toolResults.toolTimings?.[tool] || 0} ms`)
    })
    ;(toolResults.failedTools || []).forEach(tool => {
      console.log(`✗ ${tool}`)
    })
    console.log('Executor:', `${timings.executorMs || toolResults.durationMs || 0} ms`)
    console.log('------------------------')
    console.log('📦 Context')
    console.log('Pantry Items:', (toolResults.pantryItems || []).length)
    console.log('Expiring:', (toolResults.expiringItems || []).length)
    console.log('Recipes:', Array.isArray(toolResults.recipes) ? toolResults.recipes.length : toolResults.recipes ? 1 : 0)
    if (timings.featureMs !== undefined) console.log('Feature Service:', `${timings.featureMs} ms`)
    if (timings.groqMs !== undefined) console.log('Groq:', `${timings.groqMs} ms`)
    if (timings.totalMs !== undefined) console.log('Total:', `${timings.totalMs} ms`)
    console.log('------------------------')
  }

  const runFeature = async (operation, timings) => {
    const featureStartedAt = Date.now()
    const result = await Promise.resolve(operation())
    timings.featureMs = Date.now() - featureStartedAt
    return result
  }

  const completeAgentTurn = ({
    startedAt,
    plan,
    toolResults,
    timings,
    context,
    reply,
  }) => {
    timings.totalMs = Date.now() - startedAt

    if (!DEBUG_AGENT) {
      appendAgentMessage(reply)
      return
    }

    logAgentFlow(plan, toolResults, timings)
    console.log(context)
    console.log('🤖 Final Response Generated')
    appendAgentMessage(reply)
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const totalStartedAt = Date.now()
    const timings = {}
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

      const plannerStartedAt = Date.now()
      const plan = await createPlan(currentInput)
      timings.plannerMs = Date.now() - plannerStartedAt

      const executorStartedAt = Date.now()
      const toolResults = await executePlan(plan, {
        pantryItems,
      })
      timings.executorMs = Date.now() - executorStartedAt

      const context = buildContext(toolResults)

      switch (plan.intent) {
        case AGENT_INTENTS.EXPIRY_CHECK: {
          const reply = await runFeature(
            () => generateExpiryResponse(toolResults),
            timings,
          )
          completeAgentTurn({
            startedAt: totalStartedAt,
            plan,
            toolResults,
            timings,
            context,
            reply,
          })
          return
        }

        case AGENT_INTENTS.MEAL_PLAN: {
          setMealMissingItems([])

          const mealPlan = await runFeature(
            () => generateMealPlanResponse(toolResults, language, context),
            timings,
          )
          timings.groqMs = mealPlan.groqDurationMs

          setMealMissingItems(
            mealPlan.mealData?.missingIngredients || []
          )

          completeAgentTurn({
            startedAt: totalStartedAt,
            plan,
            toolResults,
            timings,
            context,
            reply: mealPlan.reply,
          })
          return
        }

        case AGENT_INTENTS.SHOPPING_LIST: {
          const shoppingPlan = await runFeature(
            () => generateShoppingListResponse(toolResults, language),
            timings,
          )
          completeAgentTurn({
            startedAt: totalStartedAt,
            plan,
            toolResults,
            timings,
            context,
            reply: shoppingPlan.reply,
          })
          return
        }

        default: {
          break
        }
      }

      const groqResult = await requestGroqChat({
        messages: [
          { role: 'system', content: buildSystemPrompt(context) },
          ...conversationHistory,
          { role: 'user', content: currentInput }
        ],
        maxTokens: 500,
        fallbackMessage: language === 'te'
          ? 'క్షమించండి, సేవ తాత్కాలికంగా అందుబాటులో లేదు.'
          : 'Chat service is temporarily unavailable.',
      })

      timings.groqMs = groqResult.durationMs

      const agentReply = groqResult.ok
        ? groqResult.content
        : groqResult.message || (language === 'te' ? 'క్షమించండి, అర్థం కాలేదు.' : 'Sorry, I could not process that.')

      completeAgentTurn({
        startedAt: totalStartedAt,
        plan,
        toolResults,
        timings,
        context,
        reply: agentReply,
      })
    } catch (e) {
      console.log('Agent Error', e)
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        text: language === 'te' ? 'క్షమించండి, ఏదో తప్పు జరిగింది.' : 'Sorry, something went wrong.'
      }])
    } finally {
      setLoading(false)
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100)
    }
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
  const wasteRisk = calculateWasteRisk(pantryItems)

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
    {wasteRisk === 'HIGH'
      ? '😱 Panic Ammamma'
      : wasteRisk ===
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
    {wasteRisk === 'HIGH'
      ? 'Too many ingredients need rescue!'
      : wasteRisk ===
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
      {wasteRisk}
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











