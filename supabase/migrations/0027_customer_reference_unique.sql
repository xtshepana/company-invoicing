-- Enforces uniqueness for non-blank customer references at the database
-- level (defense in depth for the auto-generation added alongside this
-- migration - see generateUniqueCustomerReference in
-- server/services/customers.ts). Partial (excludes '') since the column
-- has always defaulted to '' and existing customers may still have that.
create unique index customers_customer_reference_unique
  on customers (customer_reference)
  where customer_reference <> '';
