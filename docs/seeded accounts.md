# Seeded Demo Accounts

The following accounts are created when you run the `dev_seed.sql` script (or `node seeds/_apply_seed.js`).

**All accounts share the same password:** `password`

| Email                    | Full Name          | Business / Entity          | Role(s)               | Notes                                                                                     |
| ------------------------ | ------------------ | -------------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| `buyer@linko.test`       | Bianca Buyer       | Sunrise Retail Cooperative | Buyer                 | Has placed a pending order and received a delivered order.                                |
| `buyer2@linko.test`      | Ben Buyer Jr       | Davao Sari-Sari Mart       | Buyer                 | Has placed an accepted order.                                                             |
| `wholesaler@linko.test`  | Waldo Wholesaler   | Cebu Fresh Wholesale       | Wholesaler            | Owns warehouse & 6 products. Received orders from buyer and 'both' user.                  |
| `wholesaler2@linko.test` | Wendy Wholesaler   | Mandaue Agri Supply        | Wholesaler            | Owns warehouse & 5 products. Received order from buyer2 and fulfilled an order for buyer. |
| `both@linko.test`        | Bo Bothway         | Metro Cebu Trading         | Buyer & Wholesaler    | Acts as both. Has 2 products. Placed a shipped order to wholesaler.                       |
| `logistics@linko.test`   | Lia Logistics      | LINKO Logistics Hub        | Logistics Coordinator | Can manage branches, couriers, and assign parcels.                                        |
| `courier@linko.test`     | Cory Courier       | Cory Express Delivery      | Courier               | Assigned to Cebu Central Hub. Handled the delivered parcel.                               |
| `courier2@linko.test`    | Carlo Courier      | Carlo Quick Haul           | Courier               | Assigned to Mandaue Hub.                                                                  |
| `admin@linko.test`       | Pia Platform Admin | LINKO Platform             | Platform Admin        | Full platform access to dashboard metrics and (eventually) admin tools.                   |

##
