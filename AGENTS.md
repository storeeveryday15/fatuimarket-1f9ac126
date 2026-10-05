# Project Architecture Rules

- Build Fatui Pay `/submit-utr` payloads in `src/lib/fatui-pay-submit.ts` so the server contract stays testable and browser code never handles credentials.
- Route supplier fulfilment through the server-only provider adapter registry, resolving provider identity from mapped supplier services so customers cannot choose providers.