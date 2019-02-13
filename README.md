# Rhino

> !!New project - not ready yet!

Rhino is a Node.js Microsoft SQL Server driver wrapper that incorporates pooling and is powered by the well-tested and supported [tedious](http://tediousjs.github.io/tedious/api-connection.html#function_newConnection) driver. 

Rhino purposefully uses very few dependencies and is a solid SQL driver implementation built for production use. It employs a pure promise and async/await enabled API usable in modern Node.JS programs. Additionally, Rhino makes connection pooling management totally transparent - dealing with all the internal connection management for you. This means you can focus on running queries, not managing connections.

## Installation

```sh
npm i rhino --save
```

## Quick Start

```js
const rhino = require('rhino');

...
let pool = await rhino.create({
    server: 'localhost',
    authentication: {
        options: {  
            userName: "testuser",
            password: "mypassword"
        }
    },
    pool: {
        min: 0,
        max: 10
    }
});
let results = await pool.query('SELECT * FROM dbo.People');
console.log(`Count: ${results.count}`);
console.log(results.rows);
```

### Transactions

```js
    let tx = null;
    try {
        tx = await pool.transaction();
        let results = await tx
            .query('INSERT INTO dbo.People (Code, FullName) VALUES (434,\'John Bircham\')')
            .query('INSERT INTO dbo.People (Code, FullName) VALUES (@code, @name)', { code: 322, name: 'Amy Smith' })
            .query('DELETE FROM dbo.People WHERE Code = 341')
            .commit();
        console.log('Transaction committed.');
    } catch (err) {
        if (tx) tx.rollback();
        throw;
    }
```

## API

### [Class] ```Rhino```

#### ```#constructor(@config)```
Rhino fully implements the [tedious connection configuration](http://tediousjs.github.io/tedious/api-connection.html#function_newConnection) for establishing and executing database operations. All `config` properties are passed directly into the internally created and managed connections. In addition to the tedious configuration object, we utilize a merged `pool` object property which is directly passed to [generic-pool](https://github.com/coopernurse/node-pool) when a new pool instance is created.

Here's a configuration object with most of the possible properties and default values:
```json
{
    "server": "localhost",
    "port": 1433,
    "instanceName": null,
    "database": "master",
    "appName": "Tedious",
    "connectTimeout": 15000,
    "requestTimeout": 15000,
    "cancelTimeout": 5000,
    "connectionRetryInterval": 500,
    "encrypt": false,
    "authentication": {
        "type": "default",
        "options": {
            "userName": "",
            "password": "",
            "domain": ""
        }
    },
    //pool options, see generic-pool documentation for more details
    "pool": {
        "max": 1,
        "min": 0,
        //less common
        "maxWaitingClients": null,
        "acquireTimeoutMillis": null,
        "fifo": true,
        "priorityRange": 1,
        "autostart": true, //we force this to always be true
        "evictionRunIntervalMillis": 3,
        "softIdleTimeoutMillis": -1,
        "idleTimeoutMillis": 30000
    },
    //less common options, see tedious documentation for more details
    "tdsVersion": "7_4",
    "dateFormat": "mdy",
    "fallbackToDefaultDb": false,
    "enableAnsiNull": true,
    "enableAnsiNullDefault": true,
    "enableAnsiPadding": true,
    "enableAnsiWarnings": true,
    "enableConcatNullYieldsNull": true,
    "enableCursorCloseOnCommit": false,
    "enableImplicitTransactions": false,
    "enableNumericRoundabort": false,
    "enableQuotedIdentifier": true,
    "rowCollectionOnDone": false,
    "rowCollectionOnRequestCompletion": false,
    "packetSize": 4096,
    "useUTC": true,
    "abortTransactionOnError": null,
    "localAddress": null,
    "useColumnNames": false,
    "camelCaseColumns": false,
    "columnNameReplacer": null,
    "isolationLevel": "READ_COMMITED",
    "connectionIsolationLevel": "READ_COMMITED",
    "readOnlyIntent": false,
    "cryptoCredentialsDetails": {}
}
```

#### ```.create(@config)```
This function creates a new `Rhino` instance to act as a pool for executing database queries. You can create multiple `Rhino` instances to manage multiple pools of connections or for different databases.

```js
const rhino = require('rhino');

let pool1 = rhino.create({
        server: 'server-001',
        database: 'databaseA' 
        ... 
    });
let pool2 = rhino.create({
        server: 'server-002',
        database: 'databaseB' 
        ... 
    });
```

#### ```#transaction```

#### ```#query(@sql, ...@parameters)```