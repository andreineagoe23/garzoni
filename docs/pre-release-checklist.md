# Pre-release checklist

**Run this before every deploy. Target: <10 minutes.**

---

## 🔹 Tools

- [ ] **Tools hub loads**
- [ ] **Each of the 6 tools opens**
- [ ] **No blank screens if:**
  - calendar widget fails
  - news feed is empty
- [ ] **Completion event fires once per tool**

---

## 🔹 Profile propagation

- [ ] **Edit profile**
- [ ] **Refresh page**
- [ ] **Profile affects:**
  - portfolio goal fit
  - calendar relevance
  - next steps recommendations

---

## 🔹 News

- [ ] **News loads from cache**
- [ ] **Provider failure shows stale data**
- [ ] **No infinite loading**

---

## 🔹 Exercises (dashboard skill intent)

- [ ] **From dashboard weak skill / practice / quick card:** lands on `/exercises` with the expected focus (category or “all” if unmapped)
- [ ] **Refresh on `/exercises?skill=…`** still applies the right category when mapped
- [ ] After release, skim [monitoring red flags](./monitoring-red-flags.md) and [skill intent funnels](./analytics/skill-intent-funnels.md) for spikes (unmapped, mapped-zero, manual override)

## 🔹 Recommendations

- [ ] **Next Steps shows ≤ 3 items**
- [ ] **Each item has:**
  - reason
  - clear action
- [ ] **Click is tracked**

---

## Definition of done

- You can run this checklist in **<10 minutes**
- You do it **before every deploy**

---

See also: [Error reporting](error-reporting.md), [Monitoring red flags](monitoring-red-flags.md).
