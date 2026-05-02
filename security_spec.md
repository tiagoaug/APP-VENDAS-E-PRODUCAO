# Security Specification for Musgo (Inventory & Financial Management)

## 1. Data Invariants
- All documents must reside under a `users/{userId}` path, where `userId` matches the authenticated user ID.
- Users can only read and write their own data.
- Prices and amounts must be non-negative.
- Status fields must only accept valid enum values.
- IDs used in relations (supplierId, categoryId, etc.) should be valid strings.

## 2. The "Dirty Dozen" Payloads (Expected to be DENIED)
1. **Malicious Ownership**: Create a product in someone else's space (`/users/attacker/products/p1` while logged in as `victim`).
2. **Shadow Field injection**: Adding `isAdmin: true` to a Sale document.
3. **Negative Price**: Creating a product variation with `salePrice: -50.00`.
4. **Invalid Status**: Updating a Sale status to `SHIPPED` (not in enum).
5. **PII Leak**: Reading another user's profile or contact list (`/users/other_user/people`).
6. **Self-Promotion**: Updating an account balance to `9999999` without a corresponding transaction.
7. **Identity Spoofing**: Creating a sale where `customerId` is null but expected to be linked.
8. **Resource Poisoning**: Using a 2MB string as a product name.
9. **Orphaned Writes**: Creating a transaction without a valid `accountId`.
10. **Timestamp Fraud**: Providing a 2010 date for a new Sale `createdAt`.
11. **Bypassing Logic**: Deleting a COMPLETED transaction without authorization.
12. **Unauthorized List**: Attempting to list all products across the entire database.

## 3. Test Runner Concept
The `firestore.rules` will enforce that `request.auth.uid == userId` for all matches.
It will use `isValid[Entity]` helpers to check types and values.
It will use `affectedKeys().hasOnly()` for updates.
