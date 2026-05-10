---
name: sql-pro
description: Optimizes SQL queries, designs database schemas, and troubleshoots performance issues. Use when a user asks why their query is slow, needs help writing complex joins or aggregations, mentions database performance issues, or wants to design or migrate a schema. Invoke for complex queries, window functions, CTEs, indexing strategies, query plan analysis, covering index creation, recursive queries, EXPLAIN/ANALYZE interpretation, before/after query benchmarking, or migrating queries between database dialects (PostgreSQL, MySQL, SQL Server, Oracle).
license: MIT
metadata:
  author: https://github.com/Jeffallan
  version: "1.1.0"
  domain: language
  triggers: SQL optimization, query performance, database design, PostgreSQL, MySQL, SQL Server, window functions, CTEs, query tuning, EXPLAIN plan, database indexing
  role: specialist
  scope: implementation
  output-format: code
  related-skills: devops-engineer
---

# SQL Pro

## Core Workflow

1. **Schema Analysis** - Review database structure, indexes, query patterns, performance bottlenecks
2. **Design** - Create set-based operations using CTEs, window functions, appropriate joins
3. **Optimize** - Analyze execution plans, implement covering indexes, eliminate table scans
4. **Verify** - Run `EXPLAIN ANALYZE` and confirm no sequential scans on large tables; if query does not meet sub-100ms target, iterate on index selection or query rewrite before proceeding
5. **Document** - Provide query explanations, index rationale, performance metrics

## Reference Guide

Load detailed guidance based on context:

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Query Patterns | `references/query-patterns.md` | JOINs, CTEs, subqueries, recursive queries |
| Window Functions | `references/window-functions.md` | ROW_NUMBER, RANK, LAG/LEAD, analytics |
| Optimization | `references/optimization.md` | EXPLAIN plans, indexes, statistics, tuning |
| Database Design | `references/database-design.md` | Normalization, keys, constraints, schemas |
| Dialect Differences | `references/dialect-differences.md` | PostgreSQL vs MySQL vs SQL Server specifics |

## Quick-Reference Examples

### CTE Pattern

```sql
-- Isolate expensive subquery logic for reuse and readability
WITH ranked_orders AS (
    SELECT
        customer_id,
        order_id,
        total_amount,
        ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) AS rn
    FROM orders
    WHERE status = 'completed'          -- filter early, before the join
)
SELECT customer_id, order_id, total_amount
FROM ranked_orders
WHERE rn = 1;                           -- latest completed order per customer
```

### Window Function Pattern

```sql
-- Running total and rank within partition — no self-join required
SELECT
    department_id,
    employee_id,
    salary,
    SUM(salary)  OVER (PARTITION BY department_id ORDER BY hire_date) AS running_payroll,
    RANK()       OVER (PARTITION BY department_id ORDER BY salary DESC) AS salary_rank
FROM employees;
```

### EXPLAIN ANALYZE Interpretation

```sql
-- SQL Server: use SET STATISTICS IO ON and execution plan
SET STATISTICS IO ON;
SET STATISTICS TIME ON;

SELECT *
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.created_at > DATEADD(DAY, -30, GETUTCDATE());
```

Key things to check in the output:
- **Table Scan / Clustered Index Scan on large table** → add or fix an index
- **Estimated Rows vs Actual Rows mismatch** → update statistics with `UPDATE STATISTICS`
- **Logical Reads** → high count signals missing covering index
- **Key Lookup** → indicates a non-covering index; add INCLUDE columns

### Before / After Optimization Example

```sql
-- BEFORE: correlated subquery, one execution per row (slow)
SELECT order_id,
       (SELECT SUM(quantity) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
FROM orders o;

-- AFTER: single aggregation join (fast)
SELECT o.order_id, COALESCE(agg.item_count, 0) AS item_count
FROM orders o
LEFT JOIN (
    SELECT order_id, SUM(quantity) AS item_count
    FROM order_items
    GROUP BY order_id
) agg ON agg.order_id = o.id;

-- Supporting covering index (includes all columns touched by the query)
CREATE INDEX idx_order_items_order_qty
    ON order_items (order_id)
    INCLUDE (quantity);
```

### SQL Server Specific Patterns

```sql
-- Pagination with OFFSET/FETCH
SELECT ProductId, ProductName, UnitPrice
FROM Products
ORDER BY ProductName
OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY;

-- Upsert with MERGE
MERGE INTO Customers AS target
USING (VALUES (@CustomerId, @Name, @Email)) AS source (CustomerId, Name, Email)
    ON target.CustomerId = source.CustomerId
WHEN MATCHED THEN
    UPDATE SET Name = source.Name, Email = source.Email
WHEN NOT MATCHED THEN
    INSERT (CustomerId, Name, Email) VALUES (source.CustomerId, source.Name, source.Email);

-- Recursive CTE for hierarchical data
WITH OrgChart AS (
    -- Anchor: top-level employees
    SELECT EmployeeId, ManagerId, Name, 0 AS Level
    FROM Employees WHERE ManagerId IS NULL

    UNION ALL

    -- Recursive: subordinates
    SELECT e.EmployeeId, e.ManagerId, e.Name, oc.Level + 1
    FROM Employees e
    INNER JOIN OrgChart oc ON e.ManagerId = oc.EmployeeId
)
SELECT * FROM OrgChart ORDER BY Level, Name;

-- Parameterized queries (always use to prevent SQL injection)
SELECT * FROM Orders
WHERE CustomerId = @CustomerId
  AND OrderDate BETWEEN @StartDate AND @EndDate;
```

## Constraints

### MUST DO

- Analyze execution plans before recommending optimizations
- Use set-based operations over row-by-row processing
- Apply filtering early in query execution (before joins where possible)
- Use `EXISTS` over `COUNT` for existence checks
- Handle `NULL`s explicitly in comparisons and aggregations
- Create covering indexes for frequent queries
- Test with production-scale data volumes
- Always use parameterized queries to prevent SQL injection

### MUST NOT DO

- Use `SELECT *` in production queries
- Use cursors when set-based operations work
- Ignore platform-specific optimizations when targeting a specific dialect
- Implement solutions without considering data volume and cardinality
- Use dynamic SQL without proper parameterization

## Output Templates

When implementing SQL solutions, provide:
1. Optimized query with inline comments
2. Required indexes with rationale
3. Execution plan analysis
4. Performance metrics (before/after if applicable)
5. Platform-specific notes (SQL Server dialect considerations)
