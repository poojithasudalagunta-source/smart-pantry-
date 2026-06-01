import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'

import { supabase } from '../lib/supabase'
import { useLanguage } from '../lib/LanguageContext'

import {
  getPriorityItems,
  
} from '../services/recommendationService'


export default function RecipesScreen() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [pantryItems, setPantryItems] = useState([])

  const { t, language } = useLanguage()

  useEffect(() => {
    fetchPantryItems()
  }, [])

  const fetchPantryItems = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) return

    const { data: memberRows } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', session.user.id)

    let query = supabase
      .from('pantry_items')
      .select('name, quantity, unit, expiry_date')

    if (memberRows && memberRows.length > 0) {
      query = query.eq(
        'household_id',
        memberRows[0].household_id
      )
    } else {
      query = query.eq('user_id', session.user.id)
    }

    const { data, error } = await query

console.log('RECIPE QUERY ERROR:', error)
console.log('RECIPE QUERY DATA:', data)
console.log('MEMBER ROWS:', memberRows)

setPantryItems(data || [])
  }

  const getRecipes = async () => {
    if (pantryItems.length === 0) {
      return alert(
        language === 'te'
          ? 'ముందు పాంట్రీలో వస్తువులు జోడించండి!'
          : 'Add some items to your pantry first!'
      )
    }

    setLoading(true)
    setRecipes([])

    try {
      const priorityItems =
  getPriorityItems(pantryItems)

const priorityNames =
  priorityItems
    .slice(0, 5)
    .map(item => item.name)

const itemsList =
  priorityNames.length > 0
    ? priorityNames.join(', ')
    : pantryItems
        .map(i => i.name)
        .join(', ')

      const prompt =
        language === 'te'
          ? `నా దగ్గర ఈ పదార్థాలు ఉన్నాయి: ${itemsList}.

3 సాధారణ వంటకాలు సూచించండి.

ఈ format లో మాత్రమే JSON ఇవ్వండి:

[
  {
    "name": "వంటకం పేరు",
    "time": "20 నిమిషాలు",
    "difficulty": "సులభం",
    "ingredients": ["పదార్థం 1"],
    "missing": ["కొనవలసిన పదార్థం"],
    "steps": ["దశ 1", "దశ 2"]
  }
]

Extra text ఇవ్వకండి.`
          : `These ingredients are expiring soon:

${itemsList}

Suggest 3 recipes that help reduce food waste.

Prioritize recipes that use these ingredients first.

Return ONLY JSON in this format:

[
  {
    "name": "Recipe Name",
    "time": "20 mins",
    "difficulty": "Easy",
    "ingredients": ["ingredient 1"],
    "missing": ["ingredient not in pantry"],
    "steps": ["Step 1", "Step 2"]
  }
]

No extra text.`

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
            max_tokens: 1000,
          }),
        }
      )

      const data = await response.json()

      if (!data.choices || data.choices.length === 0) {
        alert(
          'Groq error: ' +
            (data.error?.message || 'No response')
        )
        setLoading(false)
        return
      }

      const text =
        data.choices[0].message.content

      const clean = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim()

      console.log('RAW AI RESPONSE:', clean)

      // Extract JSON safely
      const start = clean.indexOf('[')
      const end = clean.lastIndexOf(']')

      if (start === -1 || end === -1) {
        alert(
          language === 'te'
            ? 'సరైన AI response రాలేదు'
            : 'Invalid AI response'
        )

        setLoading(false)
        return
      }

      const jsonString = clean.slice(
        start,
        end + 1
      )

      let parsed = []

      try {
        parsed = JSON.parse(jsonString)
      } catch (e) {
        console.log('JSON PARSE ERROR:', e)
        console.log('JSON STRING:', jsonString)

        alert(
          language === 'te'
            ? 'AI response parse కాలేదు'
            : 'Failed to parse AI response'
        )

        setLoading(false)
        return
      }

      setRecipes(parsed)
    } catch (e) {
      console.log(e)

      alert(
        language === 'te'
          ? 'వంటకాలు తెచ్చుకోలేకపోయాం: ' +
              e.message
          : 'Failed to get recipes: ' +
              e.message
      )
    }

    setLoading(false)
  }
  const addMissingToShoppingList = async (
  missingIngredients
) => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) return

    const { data: memberRows } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', session.user.id)

    const householdId =
      memberRows?.[0]?.household_id || null

    const rows = missingIngredients.map(
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
        `✅ Added ${missingIngredients.length} items to Shopping List`
      )
    }
  } catch (e) {
    console.log(e)
    alert('Failed to add items')
  }
}
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>
        🍳 {t.recipeIdeas}
      </Text>

      <Text style={styles.subtitle}>
        {pantryItems.length}{' '}
        
        {language === 'te'
          ? 'వస్తువులు మీ పాంట్రీలో ఉన్నాయి'
          : 'items in your pantry'}
      </Text>

      {pantryItems.length > 0 && (
  <View
    style={{
      backgroundColor: '#FEF3C7',
      padding: 12,
      borderRadius: 10,
      marginBottom: 12,
    }}
  >
    <Text style={{ fontWeight: '600' }}>
      ⚠ Waste Reduction Mode
    </Text>

    <Text>
      Recipes are prioritized using ingredients
      that expire soon.
    </Text>
  </View>
)}

      <TouchableOpacity
        style={styles.button}
        onPress={getRecipes}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            ✨ {t.whatCanICook}
          </Text>
        )}
      </TouchableOpacity>

      {recipes.map((recipe, index) => (
        <View key={index} style={styles.card}>
          <TouchableOpacity
            onPress={() =>
              setExpanded(
                expanded === index ? null : index
              )
            }
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.recipeName}>
                  {recipe.name}
                </Text>

                <Text style={styles.recipeMeta}>
                  ⏱ {recipe.time} •{' '}
                  {recipe.difficulty}
                </Text>
              </View>

              <Text style={styles.chevron}>
                {expanded === index ? '▲' : '▼'}
              </Text>
            </View>
          </TouchableOpacity>

          {expanded === index && (
            <View style={styles.cardBody}>
              <Text style={styles.sectionTitle}>
                {t.ingredientsUsed}
              </Text>

              {recipe.ingredients?.map(
                (ing, i) => (
                  <Text
                    key={i}
                    style={styles.ingredient}
                  >
                    ✅ {ing}
                  </Text>
                )
              )}

              {recipe.missing?.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>
                    {t.needToBuy}
                  </Text>

                  {recipe.missing.map(
                    (ing, i) => (
                      <Text
                        key={i}
                        style={styles.missing}
                      >
                        🛒 {ing}
                      </Text>
                    )
                  )
                  
                  }
                  <TouchableOpacity
  style={{
    backgroundColor: '#22C55E',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  }}
  onPress={() =>
    addMissingToShoppingList(
      recipe.missing
    )
  }
>
  <Text
    style={{
      color: '#fff',
      fontWeight: '600',
      textAlign: 'center',
    }}
  >
    🛒 Add Missing Ingredients
  </Text>
</TouchableOpacity>

                </>
              )}

              <Text style={styles.sectionTitle}>
                {t.steps}
              </Text>

              {recipe.steps?.map(
                (step, i) => (
                  <Text
                    key={i}
                    style={styles.step}
                  >
                    {i + 1}. {step}
                  </Text>
                )
              )}
            </View>
          )}
        </View>
      ))}
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
    marginTop: 8,
  },

  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    marginBottom: 16,
  },

  button: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },

  cardHeaderLeft: {
    flex: 1,
  },

  recipeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },

  recipeMeta: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },

  chevron: {
    fontSize: 12,
    color: '#888',
  },

  cardBody: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },

  ingredient: {
    fontSize: 13,
    color: '#22C55E',
    marginBottom: 3,
  },

  missing: {
    fontSize: 13,
    color: '#EF4444',
    marginBottom: 3,
  },

  step: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
    lineHeight: 20,
  },
})