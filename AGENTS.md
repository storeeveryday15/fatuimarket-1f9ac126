# Project Architecture Rules

- Build Fatui Pay `/submit-utr` payloads in `src/lib/fatui-pay-submit.ts` so the server contract stays testable and browser code never handles credentials.
- Route supplier fulfilment through the server-only provider adapter registry, resolving provider identity from mapped supplier services so customers cannot choose providers.- Supplier price changes are only queued as admin-reviewed proposals (supplier_price_changes); catalog sync must never write customer sell prices, so price publishing stays an explicit admin decision.
- Customer package prices live only in `supplier_services.customer_price_inr`, set by admin approval with maths from `src/lib/supplier-pricing.ts`; `sell_price_inr` is deprecated (held raw USD).
- Supplier cost columns are column-revoked from anon/authenticated; admin server functions read them via the service client after `assertAdmin`, so costs never reach browsers.
