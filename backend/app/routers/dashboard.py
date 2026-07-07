"""Dashboard statistics API - powers the Dashboard screen."""

from fastapi import APIRouter

from app.db import run_query

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_stats():
    """Returns the summary numbers shown on the dashboard."""
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

    return {
        **counts,
        "revenue_by_currency": revenue_by_currency,
        "orders_by_status": orders_by_status,
    }
