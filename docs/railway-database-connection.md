# Connecting to Railway Database

This doc describes how to connect your Railway services to a Postgres database: via **private network** (recommended) or **public network**.

---

## Private network (recommended)

Use the private network to avoid egress costs and keep traffic internal.

1. In the Railway dashboard, open the **service** that should use the database (e.g. your backend).
2. Go to **Variables** and create a new variable.
3. Set its value to:
   ```text
   ${{ Postgres.DATABASE_URL }}
   ```
   Replace `Postgres` with the **exact name** of your Postgres service if it’s different.
4. Use this variable in your app as the database URL (e.g. `DATABASE_URL` in Django, Node, etc.).

Your app will then connect to the database over Railway’s private network.

---

## Public network

Connecting over the public network incurs **egress costs**. Prefer the private network when possible.

- **Connection URL** (from the Postgres service → Connect / Variables):

  ```text
  postgresql://postgres:PASSWORD@yamabiko.proxy.rlwy.net:27327/railway  # pragma: allowlist secret
  ```

  Replace `PASSWORD` with the actual password (or use the value from Railway).

- **Raw `psql` command:**

  ```bash
  PGPASSWORD=YOUR_PASSWORD psql -h yamabiko.proxy.rlwy.net -U postgres -p 27327 -d railway
  ```

- **Railway CLI:**
  ```bash
  railway connect Postgres
  ```
  Run this from a directory linked to your project (`railway link`); it will open a session to the Postgres service.

---

## Summary

| Method          | Use case                         | Egress      |
| --------------- | -------------------------------- | ----------- |
| Private network | App services talking to Postgres | No cost     |
| Public network  | Local dev, one-off `psql`, CLI   | Egress cost |

For production backends on Railway, set `DATABASE_URL=${{ Postgres.DATABASE_URL }}` in the service that runs your app and connect over the private network.
