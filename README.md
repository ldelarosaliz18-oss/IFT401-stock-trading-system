# StockTrade

StockTrade is a small virtual stock-trading site. It uses plain HTML, CSS, and
browser JavaScript for the pages, with an Express and Mongoose API that stores
users, sessions, stocks, orders, and transactions in MongoDB.

Stock prices are simulated by the server and persisted in MongoDB. Each stock
price changes every 5 seconds within a 10% band around that day's opening
price. The dashboard, orders, portfolio, and history pages refresh their data
every 5 seconds.

## Requirements

- Windows 10 or later
- Node.js (LTS recommended), which includes npm
- MongoDB Community Server
- MongoDB Shell (`mongosh`)

Trades use MongoDB transactions. A local MongoDB server must therefore run as a
replica set; a single-node replica set is sufficient.

## 1. Install MongoDB

Install MongoDB Community Server using the official
[MongoDB Community Server download page](https://www.mongodb.com/try/download/community).
The standard installer options are suitable for local development:

- Install MongoD as a Windows Service
- Run the service as the Network Service user

Install [MongoDB Shell (`mongosh`)](https://www.mongodb.com/try/download/shell)
separately if it is not already available. Open a new PowerShell window after
installation, then verify both commands are available:

```powershell
mongod --version
mongosh --version
```

## 2. Configure MongoDB as a single-node replica set

Find the `mongod.cfg` file used by the MongoDB service. With the default
installation it is commonly located at:

```text
C:\Program Files\MongoDB\Server\<version>\bin\mongod.cfg
```

Open the file with administrator permissions and add this top-level YAML
section, preserving the indentation:

```yaml
replication:
  replSetName: rs0
```

Save the file. Open **PowerShell as Administrator** and restart the service:

```powershell
Restart-Service -Name MongoDB
```

If PowerShell reports that it cannot open or stop the service, make sure the
window is elevated (Run as administrator). You can check the service with:

```powershell
Get-Service -Name MongoDB
```

Initialize the replica set once. In a regular PowerShell window, run:

```powershell
mongosh "mongodb://127.0.0.1:27017"
```

At the `mongosh` prompt, enter:

```javascript
rs.initiate()
rs.status()
```

Wait until the status shows a member in the `PRIMARY` state. If the replica set
was initialized previously, `rs.initiate()` may report that it is already
initialized; use `rs.status()` to check it instead. Exit the shell with
`exit()`.

## 3. Install and configure StockTrade

Open PowerShell in the project directory. For the default location used during
development, run:

```powershell
cd "C:\Users\WHERE EVER YOU PLACE THE FOLDER"
npm.cmd install
```

Create a `.env` file in the project root (the same folder as `server.js`) with
these settings for a default local replica set:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0
PORT=3000
```

Keep `.env` private; it is ignored by Git. If MongoDB is installed on another
machine or uses different connection settings, update `MONGODB_URI` accordingly.
The app uses the `stock_trading` database.

## 4. Start the site

From the project directory, run:

```powershell
npm.cmd start
```

Keep this PowerShell window open while using the site. Visit
<http://localhost:3000> in your browser and register an account. The first
registration creates a user with a simulated starting balance of $100,000.
On the Portfolio page, use **Deposit** and **Withdraw** to adjust simulated
cash. These controls do not transfer real money; each adjustment is recorded
in MongoDB.

Stop the server with **Ctrl+C** in the PowerShell window.

## Market and limit orders

Market orders execute immediately at the current simulated market price. To
place a limit order on the Orders page, select **Limit Order**, enter a limit
price, and submit:

- A buy limit fills when the market price is at or below the limit.
- A sell limit fills when the market price is at or above the limit.
- During market hours, pending orders are checked after each simulated price
  update (every 5 seconds).
- A buy limit only fills when the current market price is at or below the limit;
  a sell limit only fills when it is at or above the limit. The server checks
  the price again inside the fill transaction.
- Buy orders reserve cash at the limit price; any unused difference is
  returned when the order fills. Sell orders reserve the specified shares.
- Use **Cancel** in the recent orders list to cancel a pending limit order and
  release the reserved cash or shares. Completed orders cannot be cancelled.
- Pending limit orders remain visible in Recent Orders and History, with a
  Cancel action until they fill or are cancelled.
- Use the quantity shortcuts for 1, 10, or 100 shares, or **Max**. On the
  Orders page, Max depends on the selected side: buys use available cash and
  the market/limit price; sells use unreserved shares. The dashboard has
  separate **Max Buy** and **Max Sell** shortcuts.

## 5. Manage stocks and market hours

On startup, the app adds its default simulated stocks if they aren't already
in the database. Existing stock records and their current prices are preserved.
Every signed-in user can open the **Stock Management** tab to create simulated
stocks with a ticker, company name, initial price, and available share volume,
edit a stock's current market price and available shares, and configure market
hours and weekdays. The holiday calendar starts with New Year's Day,
Independence Day, and Christmas for the current and following year; add or
remove other market holidays in the calendar. The market schedule uses Eastern
Time. Market orders and pending limit-order executions are restricted to
configured trading weekdays and hours, and scheduled holidays remain closed.

## View database entries

Connect using `mongosh` as above, then run:

```javascript
use stock_trading
show collections
db.users.find({}, { password_hash: 0 })
db.stocks.find()
db.orders.find().sort({ createdAt: -1 }).limit(20)
db.transactions.find().sort({ createdAt: -1 }).limit(20)
```

The collections are `users`, `sessions`, `stocks`, `orders`, and
`transactions`. The user query excludes password hashes; avoid sharing raw
database output because it may contain personal information.

## Troubleshooting

- **`mongosh` is not recognized:** install MongoDB Shell, close and reopen
  PowerShell, and retry.
- **The MongoDB service cannot be restarted:** run PowerShell as Administrator.
- **MongoDB connection fails:** confirm the service is running, `mongod.cfg`
  contains the `rs0` replica-set setting, and the replica-set status reports a
  `PRIMARY`.
- **Trades fail with a transaction/replica-set error:** confirm the URI includes
  `?replicaSet=rs0` and MongoDB was restarted after the configuration change.
- **The market is empty:** use the Stock Management tab as an administrator to
  create stocks.
# Administrator access

Stock Management is available only to users whose MongoDB `users` document has
`admin_acc: true`. All newly registered users remain non-admin by default.
An authorized database administrator must grant this role manually; never add
an administrator-role toggle to public registration. The page is served from
`private/stock-management.html` after the session cookie and role are verified.
The stock creation/edit/deletion and market schedule/clock API operations are
also admin-only. Other signed-in users can still view stocks and market hours.

For a fresh local setup, copy `.env.example` to `.env` and replace its MongoDB
connection string with your own. The release archive deliberately excludes
`.env` and `node_modules`; run `npm install` before `npm start`.
Run `npm test` to check the admin access controls without a database connection.

