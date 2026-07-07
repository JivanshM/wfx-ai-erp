"""Vanna AI setup: turns plain-English questions into SQL.

How it works:
 1. We "train" Vanna once with our table definitions, business notes and
    example question->SQL pairs. Vanna stores them in a local vector
    database (ChromaDB).
 2. For each user question Vanna retrieves the most relevant training
    pieces and sends them + the question to the LLM (via OpenRouter),
    which writes the SQL.
"""

import os

# chromadb phones home with usage stats by default - switch that off
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

from chromadb.utils.embedding_functions.onnx_mini_lm_l6_v2 import ONNXMiniLM_L6_V2
from openai import OpenAI
from vanna.chromadb import ChromaDB_VectorStore
from vanna.openai import OpenAI_Chat

from app import config

# Create the embedding model ONCE and reuse it. Without this, chromadb
# reloads the ~90MB model from disk on every single embedding call.
embedder = ONNXMiniLM_L6_V2()


class WfxVanna(ChromaDB_VectorStore, OpenAI_Chat):
    """Vanna = a vector store (ChromaDB) + an LLM chat client (OpenRouter)."""

    def __init__(self):
        ChromaDB_VectorStore.__init__(
            self, config={"path": "vanna_data", "embedding_function": embedder}
        )
        OpenAI_Chat.__init__(
            self,
            # OpenRouter speaks the same protocol as OpenAI, just a different URL.
            # timeout: without it a stuck LLM call would hang for 10 minutes.
            client=OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=config.OPENROUTER_API_KEY,
                timeout=30.0,
                max_retries=1,
            ),
            config={"model": config.OPENROUTER_MODEL, "temperature": 0.0},
        )


vn = WfxVanna()

# ---------------------------------------------------------------
# Training data
# ---------------------------------------------------------------

TABLE_DDLS = [
    """create table suppliers (
        supplier_id text primary key,
        company_name text unique, country text, contact text,
        lead_time_days integer, rating numeric)""",
    """create table buyers (
        buyer_id text primary key,
        company_name text unique, country text, buyer_category text)""",
    """create table finished_goods (
        style_number text primary key, style_name text, category text,
        fabric text, gsm integer, color text, print text, season text,
        brand text, supplier_id text references suppliers(supplier_id),
        cost numeric, selling_price numeric, image_url text)""",
    """create table sales_orders (
        order_number text primary key,
        buyer_id text references buyers(buyer_id),
        style_number text references finished_goods(style_number),
        quantity integer, unit_price numeric, shipment_date date, status text)""",
    """create table sales_invoices (
        invoice_number text primary key,
        order_number text references sales_orders(order_number),
        amount numeric, currency text, payment_status text)""",
    """create table tech_packs (
        tech_pack_id text primary key,
        style_number text references finished_goods(style_number),
        fabric_details text, construction text, wash_instructions text)""",
]

BUSINESS_NOTES = [
    "GSM means grams per square meter - the fabric weight. Higher GSM = heavier fabric.",
    "Season codes: AW = Autumn/Winter, SS = Spring/Summer. Example: AW25 is Autumn/Winter 2025.",
    "Invoices exist in 4 currencies (INR, USD, EUR, GBP). Never add amounts of different "
    "currencies together; always group by currency when summing invoice amounts.",
    "Order value = quantity * unit_price. Prices are per piece.",
    "sales_orders.status values: Confirmed, In Production, Shipped, Delivered, Cancelled. "
    "sales_invoices.payment_status values: Paid, Pending, Partially Paid, Overdue.",
    "Product categories include: Dress, Hoodie, Jacket, Jeans, Polo, Shirt, Shorts, "
    "Skirt, Sweatshirt, T-Shirt, Trousers.",
]

EXAMPLE_PAIRS = [
    (
        "Which supplier supplied the most denim products?",
        """select s.company_name, count(*) as products
           from finished_goods fg
           join suppliers s on s.supplier_id = fg.supplier_id
           where fg.fabric ilike '%denim%'
           group by s.company_name
           order by products desc
           limit 1""",
    ),
    (
        "Show all black hoodies under 900",
        """select style_number, style_name, color, fabric, gsm, selling_price
           from finished_goods
           where category = 'Hoodie' and color = 'Black' and selling_price < 900
           order by selling_price""",
    ),
    (
        "Which buyer generated the highest revenue?",
        """select b.company_name, i.currency, sum(i.amount) as revenue
           from sales_invoices i
           join sales_orders o on o.order_number = i.order_number
           join buyers b on b.buyer_id = o.buyer_id
           group by b.company_name, i.currency
           order by revenue desc
           limit 5""",
    ),
    (
        "Show pending invoices above 1000",
        """select invoice_number, order_number, amount, currency, payment_status
           from sales_invoices
           where payment_status = 'Pending' and amount > 1000
           order by amount desc""",
    ),
    (
        "Which buyers purchased garments above 220 GSM?",
        """select distinct b.company_name, b.country
           from sales_orders o
           join buyers b on b.buyer_id = o.buyer_id
           join finished_goods fg on fg.style_number = o.style_number
           where fg.gsm > 220""",
    ),
    (
        "Show me all cotton shirts supplied by ABC Textiles",
        """select fg.style_number, fg.style_name, fg.fabric, fg.color, fg.selling_price
           from finished_goods fg
           join suppliers s on s.supplier_id = fg.supplier_id
           where fg.category = 'Shirt' and fg.fabric ilike '%cotton%'
             and s.company_name = 'ABC Textiles'""",
    ),
    (
        "Which supplier has the highest average order value?",
        """select s.company_name, round(avg(o.quantity * o.unit_price), 2) as avg_order_value
           from sales_orders o
           join finished_goods fg on fg.style_number = o.style_number
           join suppliers s on s.supplier_id = fg.supplier_id
           group by s.company_name
           order by avg_order_value desc
           limit 5""",
    ),
    (
        "How many orders are currently in production?",
        "select count(*) as orders_in_production from sales_orders where status = 'In Production'",
    ),
]


def train_if_needed():
    """Loads the training data into Vanna once (skips if already stored)."""
    if len(vn.get_training_data()) > 0:
        return
    for ddl in TABLE_DDLS:
        vn.train(ddl=ddl)
    for note in BUSINESS_NOTES:
        vn.train(documentation=note)
    for question, sql in EXAMPLE_PAIRS:
        vn.train(question=question, sql=sql)
    print("Vanna training data loaded")
