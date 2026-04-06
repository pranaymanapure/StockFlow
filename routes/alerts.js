const express = require('express');
const router = express.Router();
const db = require('../db');

// ─────────────────────────────────────────────
// GET /api/companies/:company_id/alerts/low-stock
// Returns all low-stock alerts for a company
// ─────────────────────────────────────────────

router.get('/companies/:company_id/alerts/low-stock', async (req, res) => {
  const { company_id } = req.params;

  // ── ASSUMPTION: "recent sales activity" = at least 1 sale in last 30 days
  // ── ASSUMPTION: sales velocity = total units sold in last 30 days / 30
  // ── ASSUMPTION: days_until_stockout = current_stock / daily_sales_velocity
  const RECENT_DAYS = 30;

  try {

    // ── Step 1: Check company exists
    const companyCheck = await db.query(
      `SELECT id FROM companies WHERE id = $1`,
      [company_id]
    );

    if (companyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // ── Step 2: Main query — find all low-stock products with recent sales
    //    Joins: inventory → products → warehouses → supplier_products → suppliers
    //    Filters: stock below threshold + has recent sales activity

    const alertsQuery = `
      SELECT
        p.id                  AS product_id,
        p.name                AS product_name,
        p.sku,
        p.low_stock_threshold AS threshold,

        w.id                  AS warehouse_id,
        w.name                AS warehouse_name,

        i.quantity            AS current_stock,

        -- Sales velocity: units sold in last 30 days
        COALESCE(sales.total_sold, 0)           AS total_sold_recently,

        -- Daily velocity (avoid divide by zero)
        CASE
          WHEN COALESCE(sales.total_sold, 0) = 0 THEN NULL
          ELSE ROUND(COALESCE(sales.total_sold, 0)::NUMERIC / $2, 2)
        END AS daily_velocity,

        -- Days until stockout (avoid divide by zero)
        CASE
          WHEN COALESCE(sales.total_sold, 0) = 0 THEN NULL
          ELSE ROUND(
            i.quantity::NUMERIC / 
            (COALESCE(sales.total_sold, 0)::NUMERIC / $2)
          )
        END AS days_until_stockout,

        -- Supplier info
        s.id                  AS supplier_id,
        s.name                AS supplier_name,
        s.contact_email       AS supplier_email

      FROM inventory i

      -- Join product
      JOIN products p 
        ON p.id = i.product_id
        AND p.company_id = $1           -- only this company's products

      -- Join warehouse (must belong to this company)
      JOIN warehouses w 
        ON w.id = i.warehouse_id
        AND w.company_id = $1

      -- Recent sales subquery: sum quantity from inventory_logs in last N days
      LEFT JOIN (
        SELECT
          il.inventory_id,
          SUM(il.quantity_before - il.quantity_after) AS total_sold
        FROM inventory_logs il
        WHERE
          il.change_type = 'sale'
          AND il.created_at >= NOW() - ($2 || ' days')::INTERVAL
        GROUP BY il.inventory_id
      ) sales ON sales.inventory_id = i.id

      -- Join supplier (take first supplier if multiple exist)
      LEFT JOIN supplier_products sp 
        ON sp.product_id = p.id
      LEFT JOIN suppliers s 
        ON s.id = sp.supplier_id

      WHERE
        -- Core filter: current stock is below threshold
        i.quantity < p.low_stock_threshold

        -- Only products with recent sales activity (has at least 1 sale)
        AND COALESCE(sales.total_sold, 0) > 0

      ORDER BY days_until_stockout ASC NULLS LAST  -- most urgent first
    `;

    const result = await db.query(alertsQuery, [company_id, RECENT_DAYS]);

    // ── Step 3: Shape the response into the required format
    const alerts = result.rows.map(row => ({
      product_id:         row.product_id,
      product_name:       row.product_name,
      sku:                row.sku,
      warehouse_id:       row.warehouse_id,
      warehouse_name:     row.warehouse_name,
      current_stock:      row.current_stock,
      threshold:          row.threshold,
      days_until_stockout: row.days_until_stockout
                            ? parseInt(row.days_until_stockout)
                            : null,
      supplier: row.supplier_id ? {
        id:            row.supplier_id,
        name:          row.supplier_name,
        contact_email: row.supplier_email,
      } : null,  // product might have no supplier linked yet
    }));

    // ── Step 4: Return response
    return res.status(200).json({
      alerts,
      total_alerts: alerts.length,
    });

  } catch (err) {
    console.error('[low-stock alert error]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
