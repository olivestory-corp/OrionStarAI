# Advice 3C Scene - Product Data Configuration

This scene requires product data to function properly. Follow the steps below to configure the data.

## Data File Setup

1. **Copy the sample file**
   ```bash
   cp advice_lite.json.sample advice_lite.json
   ```

2. **Replace with your actual data**

   Edit `advice_lite.json` with your real product catalog data.

## Data Structure

The JSON file should follow this structure:

```json
{
  "fetchTime": "2025-12-08T18:05:57.793Z",
  "totalCategories": 2,
  "totalProducts": 100,
  "categories": [
    {
      "name": "Category Name",
      "slug": "category-slug",
      "iconUrl": "https://example.com/icon.png",
      "productCount": 50,
      "products": [
        {
          "code": "A0000001",
          "name": "Product Name",
          "brand": "BRAND",
          "spec": "Product specifications",
          "priceSrp": 12900,
          "priceSale": 10790,
          "discount": 16.4,
          "type": "instock",
          "warranty": "1Y",
          "menuListName": "Menu Category",
          "menuListDtlName": "Sub Category",
          "installmentMonths": [3, 6, 10],
          "installmentBanks": ["Bank A", "Bank B"],
          "hasPromotion": true,
          "fastDelivery": true,
          "views": "1.0 K",
          "picUrl": "https://example.com/product.jpg",
          "productUrl": "https://example.com/product-page"
        }
      ]
    }
  ]
}
```

## Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Unique product identifier |
| `name` | string | Product display name |
| `brand` | string | Brand name |
| `spec` | string | Technical specifications |
| `priceSrp` | number | Suggested retail price |
| `priceSale` | number | Current sale price |
| `discount` | number | Discount percentage |
| `type` | string | Stock status: `instock`, `order_center`, etc. |
| `warranty` | string | Warranty period (e.g., "1Y", "2Y") |
| `installmentMonths` | array | Available installment plans |
| `installmentBanks` | array | Supported banks for installment |
| `hasPromotion` | boolean | Whether product has active promotion |
| `fastDelivery` | boolean | Fast delivery availability |
| `views` | string | View count (e.g., "1.0 K") |
| `picUrl` | string | Product image URL |
| `productUrl` | string | Product detail page URL |

## Notes

- The `advice_lite.json` file is excluded from version control via `.gitignore`
- Keep your product data up-to-date for accurate recommendations
- Large datasets (10,000+ products) are supported
