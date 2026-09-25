# Production Capacity Model & Scaling Projections

## 1. Growth Scaling Projections

| Scale Tier | Daily Active Users (DAU) | Concurrent Users (Peak) | Messages / Min (Peak) | AI Token Budget / Day | Database Storage (GB) | Recommended API Containers | Recommended Worker Tasks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Tier 1 (Seed)** | 1,000 | 100 | 250 | 50M | 20 GB | 2 | 2 |
| **Tier 2 (Growth)**| 10,000 | 1,200 | 3,000 | 500M | 100 GB | 6 | 4 |
| **Tier 3 (Scale)** | 100,000 | 15,000 | 35,000 | 5B | 800 GB | 24 | 16 |
| **Tier 4 (Market)**| 1,000,000 | 180,000 | 450,000 | 60B | 5 TB | 80 | 40 |

---

## 2. Resource Sizing & Headroom Policy

- **CPU Headroom:** Minimum 40% unused headroom during steady-state peak hours. Autoscaling triggers when container CPU &gt; 70% for 3 consecutive minutes.
- **Memory Headroom:** Heap memory usage must remain below 75% of container memory limit.
- **Database Connection Pool:** Bounded to 25 connections max per API container; total connection limit bounded to 80% of PostgreSQL `max_connections`.
- **Redis Memory:** Eviction policy configured as `volatile-lru` with max memory threshold set to 80% of cluster instance capacity.
