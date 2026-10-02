# Holding-record workspace, not a transaction ledger

The notebook records current holding lots rather than a complete immutable
portfolio ledger. A holding has a bond quantity, purchase date, and issued
series reference; its nominal value is derived. `user_transactions` must not
be used for balance or audit claims until a separately designed ledger records
every financial event atomically. This fits the private utility posture and
avoids presenting incomplete event history as financial truth.
