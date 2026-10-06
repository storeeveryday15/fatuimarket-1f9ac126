# Roadmap

- [x] Remove Razorpay and stale screenshot-verification surfaces without altering Fatui Pay
- [x] Migrate wallet top-ups to Fatui Pay with atomic shared RRN consumption
- [x] Auto-publish secure reviews and add customer/store replies
- [x] Make the privacy-safe leaderboard reliable for guests and show review counts
- [x] Run payment, wallet, review, reply, leaderboard, privacy, and responsive tests
- [x] Repair and safely verify the production Fatui Pay UTR submission contract
- [x] Enable and validate the production Fatui Pay verified-payment webhook
- [x] Generalize supplier fulfillment for multiple providers without changing payments
  - [x] Add provider identity and provider-scoped webhook idempotency
  - [x] Route fulfilment and polling through provider adapters
  - [x] Generalize supplier catalog ownership display
  - [x] Complete mock regressions and service-sync diagnosis
- [ ] Run the temporary read-only production FlashTopup product-ID services diagnostic, then remove it
