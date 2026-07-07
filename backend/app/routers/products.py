"""Product listing API - powers the Product Search and Finished Goods Explorer screens."""

import math

from fastapi import APIRouter, HTTPException, Query

from app.db import run_query

router = APIRouter(prefix="/api/products", tags=["products"])

# Only these columns are allowed for sorting. The sort column gets placed
# directly into the SQL text, so a fixed whitelist prevents SQL injection.
SORTABLE_COLUMNS = {"style_number", "style_name", "category", "gsm", "cost", "selling_price"}


@router.get("/filters")
def get_filter_options():
    """Returns every available filter option, used to build the UI dropdowns."""

    def distinct_values(column):
        rows = run_query(f"select distinct {column} as value from finished_goods order by 1")
        return [r["value"] for r in rows]

    suppliers = run_query(
        "select supplier_id, company_name from suppliers order by company_name"
    )
    ranges = run_query(
        """
        select min(gsm) as gsm_min, max(gsm) as gsm_max,
               min(selling_price) as price_min, max(selling_price) as price_max
        from finished_goods
        """
    )[0]

    return {
        "categories": distinct_values("category"),
        "fabrics": distinct_values("fabric"),
        "colors": distinct_values("color"),
        "seasons": distinct_values("season"),
        "prints": distinct_values("print"),
        "brands": distinct_values("brand"),
        "suppliers": suppliers,
        **ranges,
    }


@router.get("")
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: str | None = None,
    fabric: str | None = None,
    color: str | None = None,
    season: str | None = None,
    print_type: str | None = Query(None, alias="print"),
    brand: str | None = None,
    supplier_id: str | None = None,
    gsm_min: int | None = None,
    gsm_max: int | None = None,
    price_min: float | None = None,
    price_max: float | None = None,
    search: str | None = None,
    sort_by: str = "style_number",
    sort_dir: str = "asc",
):
    """Returns a filtered, sorted and paginated list of finished goods."""
    if sort_by not in SORTABLE_COLUMNS:
        raise HTTPException(400, f"sort_by must be one of {sorted(SORTABLE_COLUMNS)}")
    if sort_dir not in ("asc", "desc"):
        raise HTTPException(400, "sort_dir must be 'asc' or 'desc'")

    # Build the WHERE clause piece by piece. Values always travel as %s
    # parameters - they are never pasted into the SQL string itself.
    where_parts = []
    params = []

    exact_filters = [
        ("category", category),
        ("fabric", fabric),
        ("color", color),
        ("season", season),
        ("print", print_type),
        ("brand", brand),
        ("supplier_id", supplier_id),
    ]
    for column, value in exact_filters:
        if value:
            where_parts.append(f"fg.{column} = %s")
            params.append(value)

    if gsm_min is not None:
        where_parts.append("fg.gsm >= %s")
        params.append(gsm_min)
    if gsm_max is not None:
        where_parts.append("fg.gsm <= %s")
        params.append(gsm_max)
    if price_min is not None:
        where_parts.append("fg.selling_price >= %s")
        params.append(price_min)
    if price_max is not None:
        where_parts.append("fg.selling_price <= %s")
        params.append(price_max)
    if search:
        # ilike = case-insensitive text match, % means "anything around it"
        where_parts.append("(fg.style_name ilike %s or fg.style_number ilike %s)")
        params.extend([f"%{search}%", f"%{search}%"])

    where_sql = ("where " + " and ".join(where_parts)) if where_parts else ""

    total = run_query(
        f"select count(*) as count from finished_goods fg {where_sql}", params
    )[0]["count"]

    offset = (page - 1) * page_size
    items = run_query(
        f"""
        select fg.*, s.company_name as supplier_name
        from finished_goods fg
        join suppliers s on s.supplier_id = fg.supplier_id
        {where_sql}
        order by fg.{sort_by} {sort_dir}
        limit %s offset %s
        """,
        params + [page_size, offset],
    )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total else 0,
    }


# Defined AFTER "" and "/filters" so those fixed paths win the route match.
@router.get("/{style_number}")
def product_detail(style_number: str):
    """Everything about one product: attributes, supplier, tech pack, order history."""
    products = run_query(
        """
        select fg.*, s.company_name as supplier_name, s.country as supplier_country,
               s.lead_time_days, s.rating as supplier_rating
        from finished_goods fg
        join suppliers s on s.supplier_id = fg.supplier_id
        where fg.style_number = %s
        """,
        [style_number],
    )
    if not products:
        raise HTTPException(404, f"Unknown product: {style_number}")

    tech_packs = run_query(
        "select fabric_details, construction, wash_instructions from tech_packs where style_number = %s",
        [style_number],
    )

    order_summary = run_query(
        """
        select count(*)                       as orders,
               coalesce(sum(quantity), 0)     as total_pieces,
               coalesce(sum(quantity * unit_price), 0) as total_value
        from sales_orders
        where style_number = %s
        """,
        [style_number],
    )[0]

    recent_orders = run_query(
        """
        select o.order_number, b.company_name as buyer, o.quantity,
               o.shipment_date, o.status
        from sales_orders o
        join buyers b on b.buyer_id = o.buyer_id
        where o.style_number = %s
        order by o.shipment_date desc
        limit 5
        """,
        [style_number],
    )

    return {
        "product": products[0],
        "tech_pack": tech_packs[0] if tech_packs else None,
        "order_summary": order_summary,
        "recent_orders": recent_orders,
    }
