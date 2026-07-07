"""Dashboard statistics API - powers the Dashboard screen."""

import json
import time

from fastapi import APIRouter

from app import config, llm
from app.db import run_query

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def collect_stats():
    """All the aggregate numbers the dashboard shows."""
    counts = run_query(
        """
        select
            (select count(*) from finished_goods) as total_finished_goods,
            (select count(*) from suppliers)      as total_suppliers,
            (select count(*) from buyers)         as total_buyers,
            (select count(*) from sales_orders)   as total_orders
        """
    )[0]

    # Invoices exist in 4 different currencies, so revenue is reported
    # per currency - adding rupees to dollars in one number would be wrong.
    revenue_by_currency = run_query(
        """
        select currency,
               count(*)    as invoices,
               sum(amount) as total_invoiced,
               sum(amount) filter (where payment_status = 'Paid') as total_paid
        from sales_invoices
        group by currency
        order by total_invoiced desc
        """
    )

    # Order counts grouped by status (Confirmed, Shipped, Delivered...)
    orders_by_status = run_query(
        """
        select status, count(*) as count
        from sales_orders
        group by status
        order by count desc
        """
    )

    # Orders shipped per month - the trend line
    monthly_orders = run_query(
        """
        select to_char(date_trunc('month', shipment_date), 'Mon YY') as month,
               date_trunc('month', shipment_date) as month_start,
               count(*)      as orders,
               sum(quantity) as pieces
        from sales_orders
        group by 1, 2
        order by month_start
        """
    )
    for m in monthly_orders:
        m.pop("month_start")  # only needed for sorting

    # Who buys the most (by pieces ordered)
    top_buyers = run_query(
        """
        select b.company_name, count(*) as orders, sum(o.quantity) as pieces
        from sales_orders o
        join buyers b on b.buyer_id = o.buyer_id
        group by b.company_name
        order by pieces desc
        limit 5
        """
    )

    # Average profit margin per category: (selling - cost) / cost
    category_margins = run_query(
        """
        select category,
               round(avg((selling_price - cost) / cost * 100), 1) as margin_pct,
               count(*) as products
        from finished_goods
        group by category
        order by margin_pct desc
        """
    )

    return {
        **counts,
        "revenue_by_currency": revenue_by_currency,
        "orders_by_status": orders_by_status,
        "monthly_orders": monthly_orders,
        "top_buyers": top_buyers,
        "category_margins": category_margins,
    }


@router.get("/stats")
def get_stats():
    """Returns the summary numbers shown on the dashboard."""
    return collect_stats()


# The AI insights are cached in memory: computing them costs an LLM call,
# and the underlying data doesn't change - so one call serves everyone
# for the next hour.
_insights_cache = {"data": None, "expires": 0.0}
INSIGHTS_TTL_SECONDS = 3600


@router.get("/insights")
def get_insights():
    """Three short, AI-written observations about the business data."""
    now = time.time()
    if _insights_cache["data"] and now < _insights_cache["expires"]:
        return _insights_cache["data"]

    stats = collect_stats()
    try:
        response = llm.client.chat.completions.create(
            model=config.OPENROUTER_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "You are analysing apparel-ERP data. Here are aggregate numbers "
                        "as JSON:\n" + json.dumps(stats, default=str) + "\n\n"
                        "Write exactly 3 short insights a business manager would find "
                        "genuinely useful (trends, risks, standouts). Each under 25 words, "
                        "specific, with real numbers from the data. Never add amounts of "
                        "different currencies together. Reply with ONLY a JSON array of "
                        "3 strings."
                    ),
                }
            ],
            max_tokens=220,
            temperature=0.3,
        )
        text = response.choices[0].message.content.strip()
        text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        insights = json.loads(text)[:3]
    except Exception as exc:
        return {"insights": [], "error": f"Could not generate insights: {exc}"}

    result = {"insights": insights}
    _insights_cache["data"] = result
    _insights_cache["expires"] = now + INSIGHTS_TTL_SECONDS
    return result
