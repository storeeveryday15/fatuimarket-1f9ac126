# Project Architecture Rules

- Build Fatui Pay `/submit-utr` payloads in `src/lib/fatui-pay-submit.ts` so the server contract stays testable and browser code never handles credentials.