import os

mapping = {
    "1.png": "pantry-health.png",
    "2.png": "recipe-recommendation.png",
    "3.png": "family-sharing.png",
    "4.png": "smart-shopping.png",
    "5.png": "kitchen-dashboard.png",
    "6.png": "food-rescue.png",
    "7.png": "ingredient-insights.png",
    "8.png": "waste-saved.png",
    "9.png": "ammamma.png",
    "10.png": "grocery-bag.png",
    "11.png": "food-rescue-box.png",
    "12.png": "shopping-cart.png",
    "13.png": "cooking.png",
    "14.png": "empty-pantry.png",
    "15.png": "onboarding-welcome.png",
    "16.png": "bill-scanner.png",
    "17.png": "notifications.png",
    "18.png": "meal-planner.png",
    "19.png": "achievements.png",
}

for old_name, new_name in mapping.items():
    if os.path.exists(old_name):
        os.rename(old_name, new_name)
        print(f"{old_name} -> {new_name}")

print("Done!")