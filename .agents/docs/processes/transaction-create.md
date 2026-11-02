# Creating a transaction

1. Check whether the system already has the transaction, so nothing is entered twice.
2. Create one transaction per charge. A purchase can charge more than once, on the same account or on different ones (e.g. Uber). Attach all of them to the same event.
3. Set the timestamp to when the account was charged, not when the purchase happened. Keep it true to the account's timezone.
4. Set the amount in the account's currency, signed from the holder's view (a card purchase is negative). For a foreign-currency purchase, the original local amount goes on the event entry, not the transaction.
5. Tag the payment service when no physical card or real card number was present (e.g. Apple Pay, Zelle, PayPal). Bilt BillPay is not a service and gets no tag.

## Special cases

- Waymo Wallet credit: ignore it and record only what the card was charged.
- Amex dining credit: add it as a credit transaction on the purchase's event, not as a separate event.
- Award booking: the miles redeemed go on the reward account (negative) alongside the cash or tax charge on the card, both on one event.

## Flag instead of creating

Skip the purchase and flag it when any of these is unknown:

- The charged account.
- The charged amount in the account's currency.
- The payment service, when one was used.

To flag, report the email title, what is already known, and a list of issues that need clarification.
