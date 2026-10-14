#!/usr/bin/env python3
"""Pull events from the collector (or read a CSV/JSON file) and print a plain-text report."""
import argparse, os, sys, json
import pandas as pd

def load(args):
    if args.file:
        return pd.read_csv(args.file) if args.file.endswith(".csv") else pd.read_json(args.file)
    import requests
    url, token = args.url or os.getenv("PC_URL"), args.token or os.getenv("PC_TOKEN")
    if not url or not token:
        sys.exit("Provide --file, or --url and --token (or PC_URL / PC_TOKEN).")
    r = requests.get(url.rstrip("/") + "/export", headers={"Authorization": f"Bearer {token}"}, timeout=30)
    r.raise_for_status()
    return pd.DataFrame(r.json())

def pct(a, b):
    return f"{(100 * a / b):.0f}%" if b else "n/a"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file"); ap.add_argument("--url"); ap.add_argument("--token")
    ap.add_argument("--out", help="also write the report to this file")
    args = ap.parse_args()
    df = load(args)
    if df.empty:
        sys.exit("No events yet.")
    df["when"] = pd.to_datetime(df["ts"], unit="s")
    df["day"] = df["when"].dt.date
    df["detail"] = df["detail"].fillna("").astype(str)

    sessions = df.groupby("sid")
    n = df["sid"].nunique()
    def reached(event, detail=None):
        m = df["event"] == event
        if detail is not None:
            m &= df["detail"] == detail
        return df.loc[m, "sid"].nunique()

    out = []
    out.append(f"Visits: {n}   Date range: {df['day'].min()} to {df['day'].max()}\n")

    out.append("Funnel (share of visits)")
    steps = [
        ("Opened any module", reached("module_open")),
        ("Tried the prompt builder", reached("builder_used")),
        ("Reached pricing", reached("section_view", "pricing")),
        ("Clicked a reserve button", reached("cta_click")),
    ]
    for label, k in steps:
        out.append(f"  {label:<28}{k:>5}  {pct(k, n)}")

    out.append("\nModule opens (unique visits)")
    mo = df[df.event == "module_open"].groupby("detail")["sid"].nunique().sort_index()
    out += [f"  Module {k:<4}{v:>5}  {pct(v, n)}" for k, v in mo.items()] or ["  none yet"]

    out.append("\nSections reached")
    sv = df[df.event == "section_view"].groupby("detail")["sid"].nunique().sort_values(ascending=False)
    out += [f"  {k:<10}{v:>5}  {pct(v, n)}" for k, v in sv.items()] or ["  none yet"]

    out.append("\nFAQ questions opened")
    fq = df[df.event == "faq_open"].groupby("detail")["sid"].nunique().sort_values(ascending=False)
    out += [f"  {v:>3}  {k}" for k, v in fq.items()] or ["  none yet"]

    first = df.sort_values("ts").groupby("sid").first()
    out.append("\nDevices")
    out += [f"  {k or 'unknown':<9}{v:>5}  {pct(v, n)}" for k, v in first["device"].value_counts().items()]

    out.append("\nTop referrers")
    refs = first["ref"].replace("", "(direct)").value_counts().head(8)
    out += [f"  {v:>4}  {k}" for k, v in refs.items()]

    out.append("\nVisits per day")
    perday = df.groupby("day")["sid"].nunique()
    out += [f"  {d}  {v}" for d, v in perday.items()]

    report = "\n".join(out)
    print(report)
    if args.out:
        open(args.out, "w").write(report + "\n")

if __name__ == "__main__":
    main()
