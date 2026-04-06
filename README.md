# StockFlow - Backend Engineering Case Study

This repository contains my solution for the Backend Engineering Intern case study at Bynry.

The objective of this case study is to design and implement a scalable backend system for a B2B inventory management platform that supports multi-warehouse inventory tracking, supplier management, and intelligent low-stock alerts.

---

## 🚀 Key Highlights

- Robust API validation and transaction handling
- Scalable relational database design
- Low-stock alert system with real-world business logic
- Authentication and authorization support
- Production-grade error handling and edge case coverage

---

# 🧩 Part 1: Code Review & Debugging

## 🔍 Issues Identified

| Issue | Impact | Severity |
|------|--------|----------|
| No input validation | Server crashes on bad input | 🔴 High |
| No SKU uniqueness | Duplicate products, data corruption | 🔴 High |
| Multiple commits | Partial data inconsistency | 🔴 High |
| No HTTP status codes | Poor API usability | 🟡 Medium |
| Invalid price handling | Financial data corruption | 🟡 Medium |
| No authorization | Security vulnerability | 🔴 High |

---

## 💥 Improvements Implemented

- Added request validation
- Enforced SKU uniqueness (409 Conflict)
- Implemented atomic transactions
- Added proper HTTP status codes
- Added rollback on failure
- Introduced authorization checks

---

## 🛠️ Fixed API Implementation (Flask)

```python
@app.route('/api/products', methods=['POST'])
def create_product():
    data = request.get_json()
    if not data:
        return {"error": "Invalid or missing JSON body"}, 400

    required_fields = ['name', 'sku', 'price', 'warehouse_id', 'initial_quantity']
    missing = [f for f in required_fields if f not in data]
    if missing:
        return {"error": f"Missing required fields: {missing}"}, 400

    try:
        price = float(data['price'])
        if price < 0:
            raise ValueError()
    except (ValueError, TypeError):
        return {"error": "Price must be a positive number"}, 400

    if Product.query.filter_by(sku=data['sku']).first():
        return {"error": f"SKU '{data['sku']}' already exists"}, 409

    try:
        product = Product(
            name=data['name'],
            sku=data['sku'],
            price=price,
            warehouse_id=data['warehouse_id']
        )
        db.session.add(product)
        db.session.flush()

        inventory = Inventory(
            product_id=product.id,
            warehouse_id=data['warehouse_id'],
            quantity=data['initial_quantity']
        )
        db.session.add(inventory)

        db.session.commit()

    except Exception as e:
        db.session.rollback()
        return {"error": "Failed to create product", "details": str(e)}, 500

    return {"message": "Product created", "product_id": product.id}, 201
