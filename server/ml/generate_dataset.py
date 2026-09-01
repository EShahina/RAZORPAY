"""
MerchantShield AI — Synthetic-but-realistic labeled transaction corpus generator.

Produces a CSV/JSON corpus of ~20,000 transactions with a documented schema for
training a fraud-risk model for CNP (card-not-present) ecommerce merchants.

Design assumptions (documented for transparency & reproducibility):
  - Class balance: ~95% legitimate / ~5% fraud by design (natural imbalance in
    ecommerce payments).
  - Fraud split: ~60% true fraud (stolen card / account takeover), ~40%
    friendly fraud (false chargeback / refund abuse). Both labeled `is_fraud=1`
    since either produces chargeback loss; `fraud_type` distinguishes them.
  - ALL PII is synthetic (faker-style names, disposable domains, IN phone/UPI
    patterns, private IP ranges). Not real customer data.
  - Amounts in Indian Rupees (INR). Merchant verticals reflect Razorpay SMB mix.
  - 7 features are computable from raw fields and match the server feature layer:
      1. amount_deviation     — |amount - merchant_avg_amount| / merchant_avg_amount (min-max normalized 0..1)
      2. account_age_days     — days since customer account created (normalized <7d high risk)
      3. attempt_count        — payment retries for the same order (normalized)
      4. velocity             — number of txns from same email/device in last 60 min (normalized)
      5. chargeback_history   — prior chargeback rate for this customer/card (normalized)
      6. refund_history       — prior refund rate for this customer (normalized)
      7. amount_magnitude     — log-scaled txn amount (min-max normalized)

Feature normalization is intentionally simple (min-max) and pure (unit-testable);
the model is a calibrated GBM. See train_model.py for the model & evaluation.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import random
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta

random.seed(2026)  # reproducible corpus

# ---------------------------------------------------------------- constants ---
N_DEFAULT = 20_000
FRAUD_RATE = 0.05

VERTICALS = ["fashion_d2c", "electronics", "health_supplements", "grocery_delivery",
             "beauty", "home_decor", "membership_subscriptions", "travel_bookings"]

PAYMENT_METHODS = ["card", "upi", "netbanking", "wallet"]
CARD_BRANDS = ["visa", "mastercard", "rupay", "amex"]
UPI_APPS = ["@upi", "@ybl", "@okhdfcbank", "@paytm", "@okaxis", "@apl"]

FIRST_NAMES = ["Aarav", "Diya", "Arjun", "Ananya", "Vivaan", "Isha", "Kabir", "Meera",
               "Rohan", "Sara", "Aditya", "Priya", "Rahul", "Neha", "Karan", "Simran",
               "Nikhil", "Tanvi", "Varun", "Riya", "Amit", "Pooja", "Sandeep", "Kavya"]
LAST_NAMES = ["Sharma", "Verma", "Reddy", "Iyer", "Nair", "Patel", "Singh", "Gupta",
              "Mehta", "Rao", "Khan", "Das", "Bose", "Menon", "Joshi", "Malhotra"]
DOMAINS = ["gmail.com", "outlook.com", "yahoo.com", "protonmail.com", "icloud.com",
           "rediffmail.com", "zoho.com", "fastmail.com"]

# Velocity lookback window (minutes) — must match server feature layer
VELOCITY_WINDOW_MIN = 60


# ---------------------------------------------------------------- helpers -----
def synthetic_email() -> str:
    f = random.choice(FIRST_NAMES).lower()
    l = random.choice(LAST_NAMES).lower()
    return f"{f}.{l}{random.randint(1, 999)}@{random.choice(DOMAINS)}"


def synthetic_phone() -> str:
    return "+91" + "".join(str(random.randint(6, 9)) if i == 0 else str(random.randint(0, 9))
                            for i in range(10))


def synthetic_ip() -> str:
    # private-range IPs for realism
    return f"{random.randint(100, 223)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}"


def synthetic_device_id() -> str:
    return "".join(random.choice("0123456789abcdef") for _ in range(32))


def synthetic_card_bin() -> str:
    brand = random.choice(CARD_BRANDS)
    pre = {"visa": "4", "mastercard": ["51", "52", "53", "54", "55"], "rupay": ["60", "65", "81"],
           "amex": "34"}[brand]
    if isinstance(pre, list):
        pre = random.choice(pre)
    return pre + "".join(str(random.randint(0, 9)) for _ in range(5))


def synthetic_upi() -> str:
    return "".join(random.choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(random.randint(6, 12))) \
        + random.choice(UPI_APPS)


# ---------------------------------------------------------------- merchant ----
@dataclass
class MerchantProfile:
    id: str
    vertical: str
    avg_amount: float
    avg_std: float


def generate_merchants(n: int) -> list[MerchantProfile]:
    profiles: list[MerchantProfile] = []
    for i in range(n):
        vertical = random.choice(VERTICALS)
        # per-vertical average order value (INR)
        avg_by_vertical = {
            "fashion_d2c": 1800, "electronics": 6500, "health_supplements": 2200,
            "grocery_delivery": 900, "beauty": 1400, "home_decor": 2600,
            "membership_subscriptions": 1200, "travel_bookings": 8500,
        }
        avg_amount = avg_by_vertical[vertical]
        profiles.append(MerchantProfile(
            id=f"mz_{i:04d}", vertical=vertical, avg_amount=avg_amount,
            avg_std=avg_amount * 0.5,
        ))
    return profiles


# ---------------------------------------------------------------- customers ---
@dataclass
class CustomerProfile:
    id: str
    email: str
    phone: str
    device_id: str
    account_age_days: int
    prior_chargebacks: float   # rate 0..1
    prior_refunds: float       # rate 0..1
    is_bad: bool               # persistent fraudster flag


def generate_customers(n: int) -> list[CustomerProfile]:
    customers: list[CustomerProfile] = []
    for i in range(n):
        is_bad = random.random() < 0.06  # ~6% repeat offenders -> ~5% net fraud
        account_age_days = random.randint(1, 2000)
        if is_bad:
            prior_chargebacks = random.uniform(0.15, 0.9)
            prior_refunds = random.uniform(0.1, 0.6)
            if random.random() < 0.3:
                account_age_days = random.randint(1, 15)  # freshly created
        else:
            prior_chargebacks = random.uniform(0, 0.05)
            prior_refunds = random.uniform(0, 0.15)
        customers.append(CustomerProfile(
            id=f"cus_{i:05d}",
            email=synthetic_email(),
            phone=synthetic_phone(),
            device_id=synthetic_device_id(),
            account_age_days=account_age_days,
            prior_chargebacks=round(prior_chargebacks, 4),
            prior_refunds=round(prior_refunds, 4),
            is_bad=is_bad,
        ))
    return customers


# ---------------------------------------------------------------- transactions
@dataclass
class RawTransaction:
    transaction_id: str
    order_id: str
    merchant_id: str
    vertical: str
    amount: float
    currency: str
    payment_method: str
    card_bin: str
    email: str
    phone: str
    ip: str
    device_id: str
    customer_id: str
    account_age_days: int
    attempts: int
    velocity: int
    prior_chargebacks: float
    prior_refunds: float
    merchant_avg_amount: float
    timestamp: str
    is_fraud: int
    fraud_type: str   # "true_fraud" | "friendly_fraud" | "none"


def normalize_minmax(value: float, lo: float, hi: float) -> float:
    if hi <= lo:
        return 0.0
    return max(0.0, min(1.0, (value - lo) / (hi - lo)))


def compute_features(tx: RawTransaction) -> dict[str, float]:
    amount_deviation = normalize_minmax(
        abs(tx.amount - tx.merchant_avg_amount) / tx.merchant_avg_amount, 0, 4)
    account_age = 1.0 if tx.account_age_days < 1 else normalize_minmax(
        max(0, 30 - tx.account_age_days), 0, 30) if tx.account_age_days < 30 else 0.1
    attempt_count = normalize_minmax(tx.attempts, 1, 8)
    velocity = normalize_minmax(tx.velocity, 0, 20)
    chargeback_history = min(1.0, tx.prior_chargebacks * 4)
    refund_history = min(1.0, tx.prior_refunds * 3)
    amount_magnitude = normalize_minmax(math.log1p(tx.amount), math.log1p(100), math.log1p(200000))
    return {
        "amount_deviation": round(amount_deviation, 5),
        "account_age": round(account_age, 5),
        "attempt_count": round(attempt_count, 5),
        "velocity": round(velocity, 5),
        "chargeback_history": round(chargeback_history, 5),
        "refund_history": round(refund_history, 5),
        "amount_magnitude": round(amount_magnitude, 5),
    }


def make_fraud_flags(r: random.Random, is_bad: bool, amount: float, attempts: int,
                     velocity: int, acct_age: int) -> tuple[int, str]:
    """Decide fraud label deterministically enough to hit the ~5% target."""
    if not is_bad:
        return (0, "none")
    # true-fraud generators
    if r.random() < 0.35 and amount > 3000:          # stolen card, large amount
        return (1, "true_fraud")
    if velocity >= 6:                                 # card-testing / burst
        return (1, "true_fraud")
    if attempts >= 4:                                 # bin/retry probing
        return (1, "true_fraud")
    if r.random() < 0.15 and acct_age < 7:            # account takeover on new acct
        return (1, "true_fraud")
    # friendly-fraud generators
    if r.random() < 0.25 and prior_refund_high(r):     # refund/return abuse
        return (1, "friendly_fraud")
    # bad customers commit fraud most of the time
    if r.random() < 0.55:
        return (1, "friendly_fraud")
    return (0, "none")


def prior_refund_high(r: random.Random) -> bool:
    return r.random() < 0.5


def generate_corpus(n: int, merchants: list[MerchantProfile],
                    customers: list[CustomerProfile]) -> list[RawTransaction]:
    r = random.Random(2026)
    txns: list[RawTransaction] = []
    # recency-weighted timestamps so data looks "live"
    now = datetime.utcnow()
    # used to model velocity: track recent txns per device within window
    recent_per_device: dict[str, list[datetime]] = {}

    for i in range(n):
        merchant = r.choice(merchants)
        customer = r.choice(customers)
        # base amount from merchant distribution
        amount = max(50.0, r.gauss(merchant.avg_amount, merchant.avg_std))
        if customer.is_bad:
            if r.random() < 0.5:
                amount = amount * r.uniform(1.5, 4)   # fraudsters over-buy
        amount = round(amount, 2)

        method = r.choices(PAYMENT_METHODS, weights=[0.55, 0.30, 0.10, 0.05])[0]
        ts = now - timedelta(minutes=r.uniform(0, 60 * 24 * 7))

        # velocity: count recent txns from same device in window
        recent = [t for t in recent_per_device.get(customer.device_id, [])
                  if (ts - t).total_seconds() / 60 < VELOCITY_WINDOW_MIN]
        velocity = len(recent)
        recent_per_device.setdefault(customer.device_id, []).append(ts)
        # trim history
        recent_per_device[customer.device_id] = \
            [t for t in recent_per_device[customer.device_id]
             if (ts - t).total_seconds() / 60 < VELOCITY_WINDOW_MIN]

        attempts = 1 if r.random() < 0.9 else r.randint(2, 8)

        is_fraud, fraud_type = make_fraud_flags(
            r, customer.is_bad, amount, attempts, velocity, customer.account_age_days)

        tx = RawTransaction(
            transaction_id=f"txn_{i:05d}",
            order_id=f"ord_{i:06d}",
            merchant_id=merchant.id,
            vertical=merchant.vertical,
            amount=amount,
            currency="INR",
            payment_method=method,
            card_bin=synthetic_card_bin() if method == "card" else "",
            email=customer.email,
            phone=customer.phone,
            ip=synthetic_ip(),
            device_id=customer.device_id,
            customer_id=customer.id,
            account_age_days=customer.account_age_days,
            attempts=attempts,
            velocity=velocity,
            prior_chargebacks=customer.prior_chargebacks,
            prior_refunds=customer.prior_refunds,
            merchant_avg_amount=merchant.avg_amount,
            timestamp=ts.isoformat() + "Z",
            is_fraud=is_fraud,
            fraud_type=fraud_type,
        )
        txns.append(tx)

    return txns


# ---------------------------------------------------------------- output ------
def write_csv(txns: list[RawTransaction], path: str) -> None:
    feature_columns = ["amount_deviation", "account_age", "attempt_count", "velocity",
                       "chargeback_history", "refund_history", "amount_magnitude"]
    fieldnames = [
        "transaction_id", "order_id", "merchant_id", "vertical", "amount", "currency",
        "payment_method", "card_bin", "email", "phone", "ip", "device_id", "customer_id",
        "account_age_days", "attempts", "velocity", "prior_chargebacks", "prior_refunds",
        "merchant_avg_amount", "timestamp", *feature_columns, "is_fraud", "fraud_type",
    ]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for tx in txns:
            row = asdict(tx)
            row.update(compute_features(tx))
            writer.writerow(row)


def write_meta(txns: list[RawTransaction], path: str) -> None:
    n = len(txns)
    fraud = sum(1 for t in txns if t.is_fraud)
    meta = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "total_transactions": n,
        "fraud_transactions": fraud,
        "fraud_rate": round(fraud / n, 5),
        "feature_schema": [
            "amount_deviation", "account_age", "attempt_count", "velocity",
            "chargeback_history", "refund_history", "amount_magnitude",
        ],
        "target": "is_fraud (1=fraud)",
        "fraud_type_field": "fraud_type (true_fraud|friendly_fraud|none)",
        "note": "Synthetic corpus — all PII is fake. Assumptions documented in generate_dataset.py.",
        "normalization": "min-max per feature, documented in compute_features()",
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate MerchantShield synthetic corpus")
    parser.add_argument("--n", type=int, default=N_DEFAULT)
    parser.add_argument("--merchants", type=int, default=40)
    parser.add_argument("--customers", type=int, default=6000)
    parser.add_argument("--out", default="data/corpus.csv")
    parser.add_argument("--out-meta", default="data/corpus_meta.json")
    args = parser.parse_args()

    merchants = generate_merchants(args.merchants)
    customers = generate_customers(args.customers)
    txns = generate_corpus(args.n, merchants, customers)
    write_csv(txns, args.out)
    write_meta(txns, args.out_meta)
    fraud = sum(1 for t in txns if t.is_fraud)
    print(f"Generated {len(txns)} transactions -> {args.out}")
    print(f"Fraud rate: {fraud}/{len(txns)} = {fraud / len(txns):.4f}")


if __name__ == "__main__":
    main()
