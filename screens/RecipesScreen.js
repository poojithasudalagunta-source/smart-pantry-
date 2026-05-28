import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'

export default function RecipesScreen() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [pantryItems, setPantryItems] = useState([])

  useEffect(() => {
    fetchPantryItems()
  }, [])

  const fetchPantryItems = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase
      .from('pantry_items')
      .select('name, quantity, unit')
      .eq('user_id', session.user.id)
    setPantryItems(data || [])
  }

  const getRecipes = async () => {
    if (pantryItems.length === 0) return alert('Add some items to your pantry first!')
    setLoading(true)
    setRecipes([])
    try {
      const itemsList = pantryItems.map(i => `${i.name} (${i.quantity} ${i.unit || 'pcs'})`).join(', ')
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{
            role: 'user',
            content: `I have these ingredients: ${itemsList}. Suggest 3 simple recipes I can make. Return ONLY a JSON array like this, no extra text:
[
  {
    "name": "Recipe Name",
    "time": "20 mins",
    "difficulty": "Easy",
    "ingredients": ["ingredient 1", "ingredient 2"],
    "missing": ["ingredient not in pantry"],
    "steps": ["Step 1", "Step 2", "Step 3"]
  }
]`
          }],
          max_tokens: 1000
        })
      })
      const data = await response.json()
      console.log('Groq response:', JSON.stringify(data))

      if (!data.choices || data.choices.length === 0) {
        alert('Groq error: ' + (data.error?.message || 'No response'))
        setLoading(false)
        return
      }

      const text = data.choices[0].message.content
      console.log('Raw text:', text)
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setRecipes(parsed)
    } catch (e) {
      console.log('Full error:', e)
      alert('Failed to get recipes: ' + e.message)
    }
    setLoading(false)
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>🍳 Recipe Ideas</Text>
      <Text style={styles.subtitle}>{pantryItems.length} items in your pantry</Text>

      <TouchableOpacity style={styles.button} onPress={getRecipes} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>✨ What can I cook?</Text>
        }
      </TouchableOpacity>

      {recipes.map((recipe, index) => (
        <View key={index} style={styles.card}>
          <TouchableOpacity onPress={() => setExpanded(expanded === index ? null : index)}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.recipeName}>{recipe.name}</Text>
                <Text style={styles.recipeMeta}>⏱ {recipe.time} • {recipe.difficulty}</Text>
              </View>
              <Text style={styles.chevron}>{expanded === index ? '▲' : '▼'}</Text>
            </View>
          </TouchableOpacity>

          {expanded === index && (
            <View style={styles.cardBody}>
              <Text style={styles.sectionTitle}>Ingredients:</Text>
              {recipe.ingredients.map((ing, i) => (
                <Text key={i} style={styles.ingredient}>✅ {ing}</Text>
              ))}

              {recipe.missing?.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>You need to buy:</Text>
                  {recipe.missing.map((ing, i) => (
                    <Text key={i} style={styles.missing}>🛒 {ing}</Text>
                  ))}
                </>
              )}

              <Text style={styles.sectionTitle}>Steps:</Text>
              {recipe.steps.map((step, i) => (
                <Text key={i} style={styles.step}>{i + 1}. {step}</Text>
              ))}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  header: { fontSize: 24, fontWeight: '700', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#888', marginTop: 4, marginBottom: 16 },
  button: { backgroundColor: '#22C55E', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, overflow: 'hidden', elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  cardHeaderLeft: { flex: 1 },
  recipeName: { fontSize: 16, fontWeight: '600', color: '#111' },
  recipeMeta: { fontSize: 13, color: '#888', marginTop: 2 },
  chevron: { fontSize: 12, color: '#888' },
  cardBody: { padding: 16, paddingTop: 0, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 6 },
  ingredient: { fontSize: 13, color: '#22C55E', marginBottom: 3 },
  missing: { fontSize: 13, color: '#EF4444', marginBottom: 3 },
  step: { fontSize: 13, color: '#555', marginBottom: 6, lineHeight: 20 }
})