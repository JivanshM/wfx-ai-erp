"""Supplier scorecard API - powers the Supplier Scorecard screen.

Surfaces the supplier data (rating, lead time, country) that the other
screens never show, and rolls up how much each factory actually produces
and ships by joining their products to the orders placed against them.
"""

from fastapi import APIRouter

from app.db import run_query

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


@router.get("")
def supplier_scorecard():
    """One row per supplier with sourcing + reliability metrics.

    rating and lead_time_days come straight from the suppliers table; the
    rest is rolled up by joining each supplier's products (finished_goods)
    to the sales_orders placed against those products. LEFT joins keep
    suppliers that have no products or no orders yet (their counts are 0).

    Each order maps to exactly one style, and each style to exactly one
    supplier, so joining orders through finished_goods never double-counts
    a supplier's units. Sorted best-first: highest rating, then shortest
    lead time.
    """
    rows = run_query(
        """
        select s.supplier_id,
               s.company_name,
               s.country,
               s.rating,
               s.lead_time_days,
               count(distinct fg.style_number) as product_count,
               count(distinct o.order_number)  as order_count,
               coalesce(sum(o.quantity), 0)    as units_ordered,
               count(distinct o.order_number)
                   filter (where o.status = 'Delivered') as delivered_orders
        from suppliers s
        left join finished_goods fg on fg.supplier_id = s.supplier_id
        left join sales_orders o    on o.style_number = fg.style_number
        group by s.supplier_id, s.company_name, s.country,
                 s.rating, s.lead_time_days
        order by s.rating desc nulls last, s.lead_time_days asc nulls last
        """
    )
    return {"suppliers": rows}
