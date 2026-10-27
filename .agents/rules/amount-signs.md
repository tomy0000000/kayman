# Amount and balance signs

How kayman signs money. Applies across backend and frontend.

- Transaction amounts, account balances, and statement balances are signed from
  the account holder's view: positive is money you hold, negative is money you
  owe. A $300 card purchase is `-300`. A $5,000 checking balance is `5000`.
- Every `AccountType` uses the same convention. Storage and backend logic never
  branch on account type to flip a sign.
- A statement balance is the closing balance the issuer prints ("New balance"),
  not the period's net activity. It equals the previous statement's balance plus
  the amounts of the transactions billed to it.
- Card issuers print what you owe as a positive number. The frontend translates
  at the edge: for `CREDIT_CARD` accounts, label the field as the amount owed,
  and negate the value on submit and on render.

Why: with one convention, reconciliation is a plain sum for any account. It
survives reclassifying an account's type, which updates allow. Overpaid cards
and overdrawn checking need no special cases.
