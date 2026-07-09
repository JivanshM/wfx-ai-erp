"""Buyer scorecard API - powers the Buyer Scorecard screen.

Surfaces the buyer data (country, segment) that the other screens never
show, plus how much each buyer orders and how reliably they pay - rolled
up from their orders and the invoices raised against those orders.
"""

from fastapi import APIRouter

from app.db import run_query

router = APIRouter(prefix="/api/buyers", tags=["buyers"])


@router.get("")
def buyer_scorecard():
    """One row per buyer with volume + payment-reliability metrics.

    country and buyer_category come straight from the buyers table. Order
    volume and invoice/payment counts are computed in SEPARATE subqueries,
    then joined to buyers - this matters: an order can have more than one
    invoice, so joining orders to invoices in a single pass would fan out
    and double-count units. Keeping the two roll-ups apart avoids that.

    Payment reliability is reported as invoice COUNTS (paid / overdue), not
    summed amounts, because invoice amounts are in mixed currencies and
    adding them together would be meaningless. Sorted by units, biggest
    buyers first.
    """
    rows = run_query(
        """
        select b.buyer_id,
               b.company_name,
               b.country,
               b.buyer_category,
               coalesce(o.order_count, 0)      as order_count,
               coalesce(o.units_ordered, 0)    as units_ordered,
               coalesce(inv.invoice_count, 0)  as invoice_count,
               coalesce(inv.paid_invoices, 0)  as paid_invoices,
               coalesce(inv.overdue_invoices, 0) as overdue_invoices
        from buyers b
        left join (
            select buyer_id,
                   count(*)      as order_count,
                   sum(quantity) as units_ordered
            from sales_orders
            group by buyer_id
        ) o on o.buyer_id = b.buyer_id
        left join (
            select so.buyer_id,
                   count(*) as invoice_count,
                   count(*) filter (where i.payment_status = 'Paid')    as paid_invoices,
                   count(*) filter (where i.payment_status = 'Overdue') as overdue_invoices
            from sales_invoices i
            join sales_orders so on so.order_number = i.order_number
            group by so.buyer_id
        ) inv on inv.buyer_id = b.buyer_id
        order by units_ordered desc
        """
    )
    return {"buyers": rows}
