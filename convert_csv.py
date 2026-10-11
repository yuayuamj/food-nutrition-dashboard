import csv
import json

def parse_float(val):
    try:
        v = float(val)
        return round(v, 3)
    except:
        return None

data = []
with open("nilai-gizi.csv", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        item = {
            "name": row["name"].strip(),
            "manufacturer": row["manufacturer"].strip(),
            "serving_size": row["serving_size"].strip(),
            "energy_kcal": parse_float(row["energy_kcal"]),
            "protein_g": parse_float(row["protein_g"]),
            "carbohydrate_g": parse_float(row["carbohydrate_g"]),
            "fat_g": parse_float(row["fat_g"]),
            "sugar_g": parse_float(row["sugar_g"]),
            "sodium_mg": parse_float(row["sodium_mg"]),
            "fiber_g": parse_float(row["fiber_g"]),
            "energy_pct_dv": parse_float(row["energy_percentage_dv"]),
            "protein_pct_dv": parse_float(row["protein_percentage_dv"]),
            "carbohydrate_pct_dv": parse_float(row["carbohydrate_percentage_dv"]),
            "fat_pct_dv": parse_float(row["fat_percentage_dv"]),
            "sodium_pct_dv": parse_float(row["sodium_percentage_dv"]),
        }
        data.append(item)

with open("data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Converted {len(data)} records to data.json")
