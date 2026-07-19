import { INTENTS } from "./intents";

export function createPlan(userMessage) {
  const message = userMessage.toLowerCase();

  if (
    message.includes("cook") ||
    message.includes("recipe") ||
    message.includes("make")
  ) {
    return {
      intent: INTENTS.RECIPE,
      tools: [
        "getPantryItems",
        "getExpiringItems",
        "getRecipes"
      ],
      reason: "User wants recipe recommendations."
    };
  }

  if (
    message.includes("buy") ||
    message.includes("shopping")
  ) {
    return {
      intent: INTENTS.SHOPPING,
      tools: [
        "getPantryItems",
        "getShoppingList"
      ],
      reason: "User wants shopping suggestions."
    };
  }

  if (
    message.includes("expire") ||
    message.includes("expiry")
  ) {
    return {
      intent: INTENTS.EXPIRY,
      tools: [
        "getExpiringItems"
      ],
      reason: "User wants expiry information."
    };
  }

  if (
    message.includes("waste")
  ) {
    return {
      intent: INTENTS.WASTE,
      tools: [
        "getExpiringItems",
        "getRecipes"
      ],
      reason: "User wants to reduce food waste."
    };
  }

  if (
    message.includes("meal")
  ) {
    return {
      intent: INTENTS.MEAL_PLAN,
      tools: [
        "getPantryItems",
        "getRecipes"
      ],
      reason: "User wants a meal plan."
    };
  }

  return {
    intent: INTENTS.UNKNOWN,
    tools: [
      "getPantryItems"
    ],
    reason: "Fallback intent."
  };
}