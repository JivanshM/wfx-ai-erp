"""
Loads the CSV data files into the Supabase database.

How to run:
  1. pip install -r requirements.txt
  2. Copy .env.example to .env and fill in your Supabase keys
  3. python import_data.py

Order matters: master tables first (suppliers, buyers),
then the tables that reference them (finished_goods, sales_orders).
"""

import csv
import os

from dotenv import load_dotenv
from supabase import create_client

# Load secrets from the .env file (SUPABASE_URL, SUPABASE_SERVICE_KEY)
load_dotenv()

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_KEY"],  # service key = full access, use on server side only
)

# The CSV files live in the repo root's data/ folder
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def read_csv(filename):
    """Reads a CSV file and returns a list of dictionaries (one per row)."""
    path = os.path.join(DATA_DIR, filename)
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def insert_rows(table_name, rows, batch_size=500):
    """Inserts rows in small batches (sending everything at once is slow/risky)."""
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        supabase.table(table_name).insert(batch).execute()
    print(f"{table_name}: {len(rows)} rows inserted")


def main():
    # ---------- Step 1: Master tables (nothing references them, so they go first) ----------
    suppliers = read_csv("suppliers.csv")
    insert_rows(
        "suppliers",
        [
            {
                "supplier_id": s["supplier_id"],
                "company_name": s["company_name"],
                "country": s["country"],
                "contact": s["contact"],
                "lead_time_days": int(s["lead_time_days"]),
                "rating": float(s["rating"]),
            }
            for s in suppliers
        ],
    )

    buyers = read_csv("buyers.csv")
    insert_rows(
        "buyers",
        [
            {
                "buyer_id": b["buyer_id"],
                "company_name": b["company_name"],
                "country": b["country"],
                "buyer_category": b["buyer_category"],
            }
            for b in buyers
        ],
    )

    # Build name -> ID lookup maps, because the CSVs reference by name, not ID.
    # Example: "ABC Textiles" -> "SUP-001"
    supplier_id_by_name = {s["company_name"]: s["supplier_id"] for s in suppliers}
    buyer_id_by_name = {b["company_name"]: b["buyer_id"] for b in buyers}

    # ---------- Step 2: Finished goods (convert supplier name to ID) ----------
    goods = read_csv("finished_goods.csv")
    insert_rows(
        "finished_goods",
        [
            {
                "style_number": g["style_number"],
                "style_name": g["style_name"],
                "category": g["category"],
                "fabric": g["fabric"],
                "gsm": int(g["gsm"]),
                "color": g["color"],
                "print": g["print"],
                "season": g["season"],
                "brand": g["brand"],
                "supplier_id": supplier_id_by_name[g["supplier"]],  # name -> ID
                "cost": float(g["cost"]),
                "selling_price": float(g["selling_price"]),
                "image_url": g["image_url"],
            }
            for g in goods
        ],
    )

    # ---------- Step 3: Sales orders (convert buyer name to ID) ----------
    orders = read_csv("sales_orders.csv")
    insert_rows(
        "sales_orders",
        [
            {
                "order_number": o["order_number"],
                "buyer_id": buyer_id_by_name[o["buyer"]],  # name -> ID
                "style_number": o["style_number"],
                "quantity": int(o["quantity"]),
                "unit_price": float(o["unit_price"]),
                "shipment_date": o["shipment_date"],
                "status": o["status"],
            }
            for o in orders
        ],
    )

    # ---------- Step 4: Invoices and tech packs ----------
    invoices = read_csv("sales_invoices.csv")
    insert_rows(
        "sales_invoices",
        [
            {
                "invoice_number": i["invoice_number"],
                "order_number": i["sales_order"],
                "amount": float(i["amount"]),
                "currency": i["currency"],
                "payment_status": i["payment_status"],
            }
            for i in invoices
        ],
    )

    tech_packs = read_csv("tech_packs.csv")
    insert_rows(
        "tech_packs",
        [
            {
                "tech_pack_id": t["tech_pack_id"],
                "style_number": t["style_number"],
                "fabric_details": t["fabric_details"],
                "construction": t["construction"],
                "wash_instructions": t["wash_instructions"],
            }
            for t in tech_packs
        ],
    )

    print("All data loaded successfully!")


if __name__ == "__main__":
    main()
