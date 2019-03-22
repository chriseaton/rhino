![Rhino](./rhino.png)

# Rhino

Rhino is a tough, production-focused Node.js Microsoft SQL Server driver that incorporates pooling and is powered by
the [tedious](http://tediousjs.github.io/tedious/api-connection.html#function_newConnection) driver. It was built to 
take the bullsh*t out of running database queries and let you, the developer, focus on just running some queries and 
getting reliable, fast results back from the database server.

Rhino is a solid choice because...
- It fully implements JSdoc and is tested with [VS Code](https://code.visualstudio.com/) auto-completion.
- A dependency list so small we can list it here: [tedious](https://github.com/tediousjs/tedious) and [tarn](https://github.com/Vincit/tarn.js).
- It is a solid, modern, unit-tested implementation built for heavy production use. 
- Employs async/await/Promise functions to let you work asynchronously.
- Manages connections for you using an internal pool, stop worrying about connections and just build queries.
- Open-source and accepting pull requests.

## Installation

```sh
npm i rhino --save
```
*or*
```sh
yarn add rhino
```

## Quick Start

```js
// create the rhino pool.
const rhino = require('rhino');

...
let db = await rhino.create({
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
```
```js
// run a simple query
let results = await db.query('SELECT * FROM dbo.People');
console.log(`Count: ${results.count}`);
console.table(results.rows);
```
```js
// run a parameterized query
results = await db
    .query(`SELECT @valid=IsCustomer 
            FROM contacts 
            WHERE name LIKE @firstName AND account = @number`)
    .in('firstName', 'John')
    .in('account', Query.TYPE.INT, 23494893)
    .out('valid', 'BIT');
console.log(`Count: ${results.count}`);
console.table(results.rows);
```
```js
// run queries in a transaction
let tx = null;
try {
    tx = db.transaction();
    tx.query('INSERT INTO dbo.People (Code, FullName) VALUES (434,\'John Bircham\')');
    tx.query('INSERT INTO dbo.People (Code, FullName) VALUES (@code, @name)', { code: 322, name: 'Amy Smith' });
    tx.query('DELETE FROM dbo.People WHERE Code = 341');
    let results = await tx.commit();
    console.log('Transaction committed.');
} catch (err) {
    if (tx) {
        tx.rollback();
        console.info('Transaction rolled back.');
    }
    throw err;
}
```
```js
...
// all done, forever!
// clean up resources
db.destroy(); 
```

# Feature list
- [x] Query execution:
  - [x] Basic singular SQL statements.
  - [x] SQL statements with parameters.
  - [x] Batch SQL queries (no parameters).
  - [x] Batch SQL queries returning multiple result-sets.
  - [x] Stored procedure execution with parameters.
  - [x] Stored procedures returning multiple result-sets.
- [ ] Single-Level Transactions 
- [ ] Nested Transactions 
- [ ] Streaming query results.
- [ ] Streaming bulk load.

# API 

## Classes

<dl>
<dt><a href="#ConnectedQuery">ConnectedQuery</a></dt>
<dd><p>Provides promise extensions to a <code>Query</code> object and allows it to be executed on an aquired connection.</p>
</dd>
<dt><a href="#Connection">Connection</a></dt>
<dd><p>Provides access to the database through a TDS connection.</p>
</dd>
<dt><a href="#EventTracker">EventTracker</a></dt>
<dd><p>Provides tooling to easily track event listeners and remove them from <code>EventEmitter</code> instances without affecting 
listeners added from other operations.</p>
</dd>
<dt><a href="#Log">Log</a></dt>
<dd><p>This logging class utilizes 3 modes of logging: error, warn, and debug.
The mode can be set by specifying one of the modes in the <code>RHINO_LOGGING</code> environmental variable, or through a
<code>rhino</code> instance&#39;s <code>config.logging.mode</code> property.</p>
</dd>
<dt><a href="#Query">Query</a></dt>
<dd><p>Wraps a SQL query and provides helper functions for managing parameters.</p>
</dd>
<dt><a href="#Rhino">Rhino</a></dt>
<dd><p>Rhino is a managed Microsoft SQL Server driver powered by tedious and node-pool. This class defines functionality
to execute queries and utlize transactions. Under the hood it handles all connection pooling, including opening
and closing of connections to the database. </p>
<p>You can use multiple instances of the Rhino class in your application - each one can utilize a different 
configuration.</p>
</dd>
<dt><a href="#Transaction">Transaction</a></dt>
<dd></dd>
</dl>

## Typedefs

<dl>
<dt><a href="#PromiseQuery">PromiseQuery</a> : <code><a href="#Query">Query</a></code> | <code>Promise.&lt;Result&gt;</code></dt>
<dd></dd>
</dl>

<a name="ConnectedQuery"></a>

## ConnectedQuery
Provides promise extensions to a `Query` object and allows it to be executed on an aquired connection.

**Kind**: global class  

* [ConnectedQuery](#ConnectedQuery)
    * [new ConnectedQuery(pool)](#new_ConnectedQuery_new)
    * [.pool](#ConnectedQuery+pool) : <code>tarn.Pool</code>
    * [.then([resolve], [reject])](#ConnectedQuery+then) ⇒ <code>Promise.&lt;Result&gt;</code>


* * *

<a name="new_ConnectedQuery_new"></a>

### new ConnectedQuery(pool)
Creates a new instance of a `ConnectedQuery`.


| Param | Type | Description |
| --- | --- | --- |
| pool | <code>tarn.Pool</code> | The connection pool to utilize for aquiring the connection. |


* * *

<a name="ConnectedQuery+pool"></a>

### connectedQuery.pool : <code>tarn.Pool</code>
The `tarn.Pool` instance linked to this query.

**Kind**: instance property of [<code>ConnectedQuery</code>](#ConnectedQuery)  

* * *

<a name="ConnectedQuery+then"></a>

### connectedQuery.then([resolve], [reject]) ⇒ <code>Promise.&lt;Result&gt;</code>
Thenable executor of this query using the linked connection or transaction.

**Kind**: instance method of [<code>ConnectedQuery</code>](#ConnectedQuery)  
**Throw**: Error if the `pool` property is falsey.  

| Param | Type | Description |
| --- | --- | --- |
| [resolve] | <code>function</code> | Promise callback called when the work completes successfully. |
| [reject] | <code>function</code> | Promise callback called when the work fails. |


* * *

<a name="Connection"></a>

## Connection
Provides access to the database through a TDS connection.

**Kind**: global class  

* [Connection](#Connection)
    * [new Connection(tdsConfig, log)](#new_Connection_new)
    * _instance_
        * [.config](#Connection+config) : [<code>TediousConfiguration</code>](#Connection.TediousConfiguration)
        * [.log](#Connection+log) : [<code>Log</code>](#Log)
        * [.connected](#Connection+connected) : <code>Boolean</code>
        * [.state](#Connection+state) : <code>Number</code>
        * [.id](#Connection+id) : <code>String</code>
        * [.connect()](#Connection+connect) ⇒ [<code>Promise.&lt;Connection&gt;</code>](#Connection)
        * [.disconnect()](#Connection+disconnect) ⇒ [<code>Promise.&lt;Connection&gt;</code>](#Connection)
        * ["transition"](#Connection+event_transition)
    * _static_
        * [.CONNECTION_STATE](#Connection.CONNECTION_STATE) : <code>enum</code>
        * [.TediousConfiguration](#Connection.TediousConfiguration)


* * *

<a name="new_Connection_new"></a>

### new Connection(tdsConfig, log)
Creates a new `Connection` instance.


| Param | Type | Description |
| --- | --- | --- |
| tdsConfig | [<code>TediousConfiguration</code>](#Connection.TediousConfiguration) | The configuration for the connection. |
| log | [<code>Log</code>](#Log) | A loging instance. if not provided, one is created using the given configuration. |


* * *

<a name="Connection+config"></a>

### connection.config : [<code>TediousConfiguration</code>](#Connection.TediousConfiguration)
**Kind**: instance property of [<code>Connection</code>](#Connection)  

* * *

<a name="Connection+log"></a>

### connection.log : [<code>Log</code>](#Log)
**Kind**: instance property of [<code>Connection</code>](#Connection)  

* * *

<a name="Connection+connected"></a>

### connection.connected : <code>Boolean</code>
Boolean flag indicating whether the connection is valid and alive.

**Kind**: instance property of [<code>Connection</code>](#Connection)  

* * *

<a name="Connection+state"></a>

### connection.state : <code>Number</code>
Returns the processing state of the connection.

Accessible through the `Connection.CONNECTION_STATES` object.

**Kind**: instance property of [<code>Connection</code>](#Connection)  

* * *

<a name="Connection+id"></a>

### connection.id : <code>String</code>
Randomly generated connection identifier. Output in debugging messages.

**Kind**: instance property of [<code>Connection</code>](#Connection)  

* * *

<a name="Connection+connect"></a>

### connection.connect() ⇒ [<code>Promise.&lt;Connection&gt;</code>](#Connection)
Ensures the connection to the database has been established.

If the connection is already `connected` then no action occurs and this function returns normally and only
emits the `connected` event.

If the connection is already attempting to connect, this call will (a)wait for it to complete and emit a
`connected` event if successful. 

If the connection is not established, it will be attempted and the `connecting` and `connected` events will be
emitted.

**Kind**: instance method of [<code>Connection</code>](#Connection)  
**Emits**: <code>event:connecting</code>, <code>event:connected</code>  

* * *

<a name="Connection+disconnect"></a>

### connection.disconnect() ⇒ [<code>Promise.&lt;Connection&gt;</code>](#Connection)
Disconnects from the database.

**Kind**: instance method of [<code>Connection</code>](#Connection)  
**Emits**: <code>event:disconnected</code>  

* * *

<a name="Connection+event_transition"></a>

### "transition"
Transition event fired when the connection state is changed.

**Kind**: event emitted by [<code>Connection</code>](#Connection)  
**Properties**

| Name | Type |
| --- | --- |
| newState | <code>Number</code> | 
| oldState | <code>Number</code> | 
| meta | <code>\*</code> | 


* * *

<a name="Connection.CONNECTION_STATE"></a>

### Connection.CONNECTION\_STATE : <code>enum</code>
Enumeration of connection states that a connection can be in.

1 = IDLE   
2 = CONNECTING   
3 = DISCONNECTING   
4 = TRANSACTING   
5 = EXECUTING

**Kind**: static enum of [<code>Connection</code>](#Connection)  
**Read only**: true  

* * *

<a name="Connection.TediousConfiguration"></a>

### Connection.TediousConfiguration
The tedious configuration options are all fully supported. Some options support default values from environmental
variables, all of which use the `RHINO_MSSQL_` prefix.

For more details, please refer to: [Tedious on GitHub](http://tediousjs.github.io/tedious/api-connection.html#function_newConnection)

**Kind**: static typedef of [<code>Connection</code>](#Connection)  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [server] | <code>String</code> | <code>&quot;localhost&quot;</code> | A default value is checked for under the `RHINO_MSSQL_HOST` then `RHINO_MSSQL_SERVER` environmental variables. |
| [authentication] | <code>Object</code> |  |  |
| [authentication.type] | <code>String</code> | <code>&quot;default&quot;</code> | A default value is checked for under the `RHINO_MSSQL_AUTH_TYPE` environmental variable. |
| [authentication.options] | <code>Object</code> |  |  |
| [authentication.options.userName] | <code>String</code> |  | A default value is checked for under the `RHINO_MSSQL_USER` then `RHINO_MSSQL_AUTH_USER` environmental variables. |
| [authentication.options.password] | <code>String</code> |  | A default value is checked for under the `RHINO_MSSQL_PASSWORD` then `RHINO_MSSQL_AUTH_PASSWORD` environmental variables. |
| [authentication.options.domain] | <code>String</code> |  | A default value is checked for under the `RHINO_MSSQL_DOMAIN` then `RHINO_MSSQL_AUTH_DOMAIN` environmental variables. |
| [options] | <code>Object</code> |  |  |
| [options.port] | <code>Number</code> | <code>1433</code> | A default value is checked for under the `RHINO_MSSQL_PORT` environmental variable. |
| [options.instanceName] | <code>String</code> | <code></code> | A default value is checked for under the `RHINO_MSSQL_INSTANCE` then `RHINO_MSSQL_INSTANCE_NAME` environmental variables. |
| [options.database] | <code>String</code> | <code>&quot;master&quot;</code> | A default value is checked for under the `RHINO_MSSQL_DATABASE` environmental variable. |
| [options.appName] | <code>String</code> | <code>&quot;&quot;</code> | A default value is checked for under the `RHINO_MSSQL_APP_NAME` environmental variable. |
| [options.connectTimeout] | <code>Number</code> | <code>15000</code> |  |
| [options.requestTimeout] | <code>Number</code> | <code>15000</code> |  |
| [options.cancelTimeout] | <code>Number</code> | <code>5000</code> |  |
| [options.connectionRetryInterval] | <code>Number</code> | <code>500</code> |  |
| [options.encrypt] | <code>Boolean</code> | <code>false</code> | A default value is checked for under the `RHINO_MSSQL_ENCRYPT` environmental variable. |
| [options.tdsVersion] | <code>String</code> | <code>&quot;7_4&quot;</code> |  |
| [options.dateFormat] | <code>String</code> | <code>&quot;mdy&quot;</code> |  |
| [options.fallbackToDefaultDb] | <code>Boolean</code> | <code>false</code> |  |
| [options.enableAnsiNull] | <code>Boolean</code> | <code>true</code> |  |
| [options.enableAnsiNullDefault] | <code>Boolean</code> | <code>true</code> |  |
| [options.enableAnsiPadding] | <code>Boolean</code> | <code>true</code> |  |
| [options.enableAnsiWarnings] | <code>Boolean</code> | <code>true</code> |  |
| [options.enableConcatNullYieldsNull] | <code>Boolean</code> | <code>true</code> |  |
| [options.enableCursorCloseOnCommit] | <code>Boolean</code> | <code>false</code> |  |
| [options.enableImplicitTransactions] | <code>Boolean</code> | <code>false</code> |  |
| [options.enableNumericRoundabort] | <code>Boolean</code> | <code>false</code> |  |
| [options.enableQuotedIdentifier] | <code>Boolean</code> | <code>true</code> |  |
| [options.rowCollectionOnDone] | <code>Boolean</code> | <code>false</code> |  |
| [options.rowCollectionOnRequestCompletion] | <code>Boolean</code> | <code>false</code> |  |
| [options.packetSize] | <code>Number</code> | <code>4096</code> |  |
| [options.useUTC] | <code>Boolean</code> | <code>true</code> |  |
| [options.abortTransactionOnError] | <code>Boolean</code> | <code></code> |  |
| [options.localAddress] | <code>String</code> | <code></code> |  |
| [options.useColumnNames] | <code>Boolean</code> | <code>false</code> |  |
| [options.camelCaseColumns] | <code>Boolean</code> | <code>false</code> |  |
| [options.columnNameReplacer] | <code>Boolean</code> | <code></code> |  |
| [options.isolationLevel] | <code>String</code> | <code>&quot;READ_COMMITED&quot;</code> |  |
| [options.connectionIsolationLevel] | <code>String</code> | <code>&quot;READ_COMMITED&quot;</code> |  |
| [options.readOnlyIntent] | <code>Boolean</code> | <code>false</code> |  |
| [options.cryptoCredentialsDetails] | <code>Object</code> |  |  |
| [options.debug] | <code>Object</code> |  |  |
| [options.debug.packet] | <code>Boolean</code> | <code>false</code> |  |
| [options.debug.data] | <code>Boolean</code> | <code>false</code> |  |
| [options.debug.payload] | <code>Boolean</code> | <code>false</code> |  |
| [options.debug.token] | <code>Boolean</code> | <code>false</code> |  |


* * *

<a name="EventTracker"></a>

## EventTracker
Provides tooling to easily track event listeners and remove them from `EventEmitter` instances without affecting 
listeners added from other operations.

**Kind**: global class  

* [EventTracker](#EventTracker)
    * [new EventTracker()](#new_EventTracker_new)
    * _instance_
        * [.listeners](#EventTracker+listeners) : [<code>Array.&lt;RegisteredEventListener&gt;</code>](#EventTracker.RegisteredEventListener)
        * [.removeFrom(emitter, [event], [unregister])](#EventTracker+removeFrom)
        * [.register(event, ...listeners)](#EventTracker+register)
        * [.registerOn(emitters, event, ...listeners)](#EventTracker+registerOn)
        * [.unregister([event], [...listeners])](#EventTracker+unregister)
    * _static_
        * [.RegisteredEventListener](#EventTracker.RegisteredEventListener)


* * *

<a name="new_EventTracker_new"></a>

### new EventTracker()
Creates a new `EventTracker` instance.


* * *

<a name="EventTracker+listeners"></a>

### eventTracker.listeners : [<code>Array.&lt;RegisteredEventListener&gt;</code>](#EventTracker.RegisteredEventListener)
Array containing all of the registered event listeners in this tracker instance.

**Kind**: instance property of [<code>EventTracker</code>](#EventTracker)  

* * *

<a name="EventTracker+removeFrom"></a>

### eventTracker.removeFrom(emitter, [event], [unregister])
Removes all registered matching event listeners from the specified emitter.

**Kind**: instance method of [<code>EventTracker</code>](#EventTracker)  

| Param | Type | Description |
| --- | --- | --- |
| emitter | <code>EventEmitter</code> | The instance implementing the EventEmitter "removeListener" function. |
| [event] | <code>String</code> \| <code>symbol</code> | Optional event to target for removal. Only listeners under the event will be removed. |
| [unregister] | <code>Boolean</code> | Removes the registered listeners after they have been removed from the emitter. Works with the `event` parameter, if specified. If a listerner is not found, on the emitter, it is not unregistered. |


* * *

<a name="EventTracker+register"></a>

### eventTracker.register(event, ...listeners)
Registers one or more event listeners.

**Kind**: instance method of [<code>EventTracker</code>](#EventTracker)  

| Param | Type | Description |
| --- | --- | --- |
| event | <code>String</code> \| <code>Symbol</code> | The event name or symbol. |
| ...listeners | <code>function</code> | The listener functions. |


* * *

<a name="EventTracker+registerOn"></a>

### eventTracker.registerOn(emitters, event, ...listeners)
Registers one or more event listeners in the tracker and on the specified target objects.

**Kind**: instance method of [<code>EventTracker</code>](#EventTracker)  

| Param | Type | Description |
| --- | --- | --- |
| emitters | <code>EventEmitter</code> \| <code>Array.&lt;EventEmitter&gt;</code> | An `EventEmitter` instance or array of instances to  add the specified event listeners on using the `addListener` function call. |
| event | <code>String</code> \| <code>Symbol</code> | The event name or symbol. |
| ...listeners | <code>function</code> | The listener functions. |


* * *

<a name="EventTracker+unregister"></a>

### eventTracker.unregister([event], [...listeners])
Un-registers one or more event listeners by matching the event and/or listener function(s). Either, both, or 
none of the parameters may be specified. If both event and listerner(s) are not specified, all listeners are
unregistered.

**Kind**: instance method of [<code>EventTracker</code>](#EventTracker)  

| Param | Type | Description |
| --- | --- | --- |
| [event] | <code>String</code> \| <code>Symbol</code> | The event name or symbol to match for unregistering listeners. |
| [...listeners] | <code>function</code> | The listener functions to unregister. If none are specified, all listeners under the event are unregistered. |


* * *

<a name="EventTracker.RegisteredEventListener"></a>

### EventTracker.RegisteredEventListener
**Kind**: static typedef of [<code>EventTracker</code>](#EventTracker)  
**Properties**

| Name | Type |
| --- | --- |
| event | <code>String</code> \| <code>Symbol</code> | 
| listener | <code>function</code> | 


* * *

<a name="Log"></a>

## Log
This logging class utilizes 3 modes of logging: error, warn, and debug.
The mode can be set by specifying one of the modes in the `RHINO_LOGGING` environmental variable, or through a
`rhino` instance's `config.logging.mode` property.

**Kind**: global class  

* [Log](#Log)
    * _instance_
        * [.config](#Log+config) : [<code>LogConfiguration</code>](#Log.LogConfiguration)
        * [.error()](#Log+error)
        * [.warn()](#Log+warn)
        * [.debug()](#Log+debug)
    * _static_
        * [.LogConfiguration](#Log.LogConfiguration)


* * *

<a name="Log+config"></a>

### log.config : [<code>LogConfiguration</code>](#Log.LogConfiguration)
**Kind**: instance property of [<code>Log</code>](#Log)  

* * *

<a name="Log+error"></a>

### log.error()
Logs an error to the configured error function, or if not specifed, to the `console.error`.

**Kind**: instance method of [<code>Log</code>](#Log)  

* * *

<a name="Log+warn"></a>

### log.warn()
Logs a warning message to the configured warn function, or if not specifed, to the `console.warn`.

**Kind**: instance method of [<code>Log</code>](#Log)  

* * *

<a name="Log+debug"></a>

### log.debug()
Logs a debug message to the configured debug function, or if not specifed, to the `console.debug`.

**Kind**: instance method of [<code>Log</code>](#Log)  

* * *

<a name="Log.LogConfiguration"></a>

### Log.LogConfiguration
**Kind**: static typedef of [<code>Log</code>](#Log)  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| mode | <code>Boolean</code> \| <code>String</code> |  | Can be 'none', 'error', 'warn', or 'debug for enabled logging levels. A falsey value will disable logging. A truthy value that is not a string will assume 'warn' mode. |
| [connections] | <code>Boolean</code> | <code>false</code> | Flag that indicates whether to log connection state messages. These  messages are entered on the debug log. |
| [tds] | <code>Boolean</code> | <code>false</code> | Indicates whether to log debug and info messages from underlying TDS connections. These messages are entered on the debug log. |


* * *

<a name="Query"></a>

## Query
Wraps a SQL query and provides helper functions for managing parameters.

**Kind**: global class  

* [Query](#Query)
    * [new Query()](#new_Query_new)
    * _instance_
        * [.statement](#Query+statement) : <code>String</code>
        * [.params](#Query+params) : <code>Map.&lt;String, Query.Parameter&gt;</code>
        * [.mode](#Query+mode)
        * [.requestTimeout](#Query+requestTimeout) : <code>Number</code>
        * [.timeout(ms)](#Query+timeout) ⇒ [<code>Query</code>](#Query)
        * [.sql(statement)](#Query+sql) ⇒ [<code>Query</code>](#Query)
        * [.batch()](#Query+batch) ⇒ [<code>Query</code>](#Query)
        * [.exec()](#Query+exec) ⇒ [<code>Query</code>](#Query)
        * [.in(name, [type], [value])](#Query+in) ⇒ [<code>Query</code>](#Query)
        * [.out(name, type)](#Query+out) ⇒ [<code>Query</code>](#Query)
        * [.remove(name)](#Query+remove) ⇒ <code>Boolean</code>
        * [.clear()](#Query+clear)
    * _static_
        * [.MODE](#Query.MODE)
            * [.QUERY](#Query.MODE.QUERY)
            * [.BATCH](#Query.MODE.BATCH)
            * [.EXEC](#Query.MODE.EXEC)
        * [.TYPE](#Query.TYPE)
        * [.AUTODETECT_TYPES](#Query.AUTODETECT_TYPES)
            * [.FLOATING_POINT](#Query.AUTODETECT_TYPES.FLOATING_POINT)
            * [.DATE](#Query.AUTODETECT_TYPES.DATE)
            * [.BUFFER](#Query.AUTODETECT_TYPES.BUFFER)
        * [.TDSType](#Query.TDSType)
        * [.Parameter](#Query.Parameter)


* * *

<a name="new_Query_new"></a>

### new Query()
Creates a new instance of the `Query` class.

**Example**  
The following example shows how to build a query for use in Rhino.
```js
let q = Query
         .sql(`SELECT @valid=IsCustomer 
               FROM contacts 
               WHERE name LIKE @firstName AND account = @number`)
         .in('firstName', 'John')
         .in('account', Query.TYPE.INT, 23494893)
         .out('valid', Query.TYPE.BIT);
//remove a parameter by name
q.remove('account');
//reset everything
q.clear();
```

* * *

<a name="Query+statement"></a>

### query.statement : <code>String</code>
The SQL statement.

**Kind**: instance property of [<code>Query</code>](#Query)  

* * *

<a name="Query+params"></a>

### query.params : <code>Map.&lt;String, Query.Parameter&gt;</code>
The parameters and values to use on the query.

**Kind**: instance property of [<code>Query</code>](#Query)  

* * *

<a name="Query+mode"></a>

### query.mode
The query execution mode.

**Kind**: instance property of [<code>Query</code>](#Query)  

* * *

<a name="Query+requestTimeout"></a>

### query.requestTimeout : <code>Number</code>
Command timeout value set for this query. A `null` value indicates the default will be used.

**Kind**: instance property of [<code>Query</code>](#Query)  

* * *

<a name="Query+timeout"></a>

### query.timeout(ms) ⇒ [<code>Query</code>](#Query)
Sets the SQL query request timeout.

**Kind**: instance method of [<code>Query</code>](#Query)  
**Throws**:

- Error if the `ms` argument less than 0 or not a number (or `null`).


| Param | Type | Description |
| --- | --- | --- |
| ms | <code>Number</code> | The timeout in milliseconds, or `null` to use configured defaults. |


* * *

<a name="Query+sql"></a>

### query.sql(statement) ⇒ [<code>Query</code>](#Query)
Sets the SQL query text (statment). Calling this function resets the query `mode` to an automatically determined
value.

**Kind**: instance method of [<code>Query</code>](#Query)  
**Throws**:

- Error if the `statement` argument is falsey.
- Error if the `statement` argument is not a string.


| Param | Type | Description |
| --- | --- | --- |
| statement | <code>String</code> | The SQL query text to be executed. |


* * *

<a name="Query+batch"></a>

### query.batch() ⇒ [<code>Query</code>](#Query)
Forces the query into BATCH `mode`.

**Kind**: instance method of [<code>Query</code>](#Query)  
**Throws**:

- Error if the query contains parameters.


* * *

<a name="Query+exec"></a>

### query.exec() ⇒ [<code>Query</code>](#Query)
Forces the query into EXEC `mode`.

**Kind**: instance method of [<code>Query</code>](#Query)  

* * *

<a name="Query+in"></a>

### query.in(name, [type], [value]) ⇒ [<code>Query</code>](#Query)
Adds an input parameter to the query.    
Calling this when the query `mode` is set to BATCH will reset the `mode` to QUERY.

**Kind**: instance method of [<code>Query</code>](#Query)  
**Throws**:

- Error if the `name` argument is falsey.
- Error if the `name` argument is not a string.
- Error if the `name` argument has already been specified or is not specified as a string.


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>String</code> |  | The parameter name, can be specified with the '@' character or not. |
| [type] | <code>String</code> \| [<code>TDSType</code>](#Query.TDSType) |  | The explicit database type to use, if not specified, it is auto-determined. This parameter can be omitted. |
| [value] | <code>String</code> \| <code>Number</code> \| <code>Date</code> \| <code>Buffer</code> \| <code>Object</code> \| <code>\*</code> | <code></code> | The value of the parameter. |


* * *

<a name="Query+out"></a>

### query.out(name, type) ⇒ [<code>Query</code>](#Query)
Adds an output parameter to the query.    
Calling this when the query `mode` is set to BATCH will reset the `mode` to QUERY.

**Kind**: instance method of [<code>Query</code>](#Query)  
**Throws**:

- Error if the `name` argument is falsey.
- Error if the `name` argument is not a string.
- Error if the `name` argument has already been specified or is not specified as a string.
- Error if the `type` argument is falsey.


| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | The parameter name, can be specified with the '@' character or not. |
| type | <code>\*</code> | The explicit database type to use. Must be specified on out parameters. |


* * *

<a name="Query+remove"></a>

### query.remove(name) ⇒ <code>Boolean</code>
Removes a parameter by name.

**Kind**: instance method of [<code>Query</code>](#Query)  
**Returns**: <code>Boolean</code> - Returns `true` if a parameter with the name was found and removed, or `false` if no parameter
was found with the given name.  
**Throws**:

- Error if the `name` argument is falsey.
- Error if the `name` argument is not a string.


| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | The name of the parameter to remove. |


* * *

<a name="Query+clear"></a>

### query.clear()
Clears all query criteria, including SQL statement values and parameters. The `Query` instance is fully reset
to a blank slate.

**Kind**: instance method of [<code>Query</code>](#Query)  

* * *

<a name="Query.MODE"></a>

### Query.MODE
The mode that determines how the query should be executed.

**Kind**: static property of [<code>Query</code>](#Query)  

* [.MODE](#Query.MODE)
    * [.QUERY](#Query.MODE.QUERY)
    * [.BATCH](#Query.MODE.BATCH)
    * [.EXEC](#Query.MODE.EXEC)


* * *

<a name="Query.MODE.QUERY"></a>

#### MODE.QUERY
Indicates the query should be run using the `execSql` function. This is the most common mode that supports 
parameters.

**Kind**: static property of [<code>MODE</code>](#Query.MODE)  

* * *

<a name="Query.MODE.BATCH"></a>

#### MODE.BATCH
This mode indicates the query should run using the `execSqlBatch` function. This mode does not support
parameters and is meant for multi-statement queries.

**Kind**: static property of [<code>MODE</code>](#Query.MODE)  

* * *

<a name="Query.MODE.EXEC"></a>

#### MODE.EXEC
This mode indicates the query is a stored procedure call, and is executed using the `callProcedure` function.

**Kind**: static property of [<code>MODE</code>](#Query.MODE)  

* * *

<a name="Query.TYPE"></a>

### Query.TYPE
TDS column types.

**Kind**: static property of [<code>Query</code>](#Query)  

* * *

<a name="Query.AUTODETECT_TYPES"></a>

### Query.AUTODETECT\_TYPES
Auto-detection types used when a type is not specifically detected, but a 
value is provided. Only certain types can be configured.

**Kind**: static property of [<code>Query</code>](#Query)  

* [.AUTODETECT_TYPES](#Query.AUTODETECT_TYPES)
    * [.FLOATING_POINT](#Query.AUTODETECT_TYPES.FLOATING_POINT)
    * [.DATE](#Query.AUTODETECT_TYPES.DATE)
    * [.BUFFER](#Query.AUTODETECT_TYPES.BUFFER)


* * *

<a name="Query.AUTODETECT_TYPES.FLOATING_POINT"></a>

#### AUTODETECT_TYPES.FLOATING\_POINT
The TDS type used when a floating point number value is detected. 
Defaults to `Float`.

**Kind**: static property of [<code>AUTODETECT\_TYPES</code>](#Query.AUTODETECT_TYPES)  

* * *

<a name="Query.AUTODETECT_TYPES.DATE"></a>

#### AUTODETECT_TYPES.DATE
The TDS type used when a Date object value is detected.
Defaults to `DateTimeOffset`.

**Kind**: static property of [<code>AUTODETECT\_TYPES</code>](#Query.AUTODETECT_TYPES)  

* * *

<a name="Query.AUTODETECT_TYPES.BUFFER"></a>

#### AUTODETECT_TYPES.BUFFER
The TDS type used when a Buffer object value is detected. 
Defaults to `VarBinary`.

**Kind**: static property of [<code>AUTODETECT\_TYPES</code>](#Query.AUTODETECT_TYPES)  

* * *

<a name="Query.TDSType"></a>

### Query.TDSType
**Kind**: static typedef of [<code>Query</code>](#Query)  
**Properties**

| Name | Type |
| --- | --- |
| id | <code>Number</code> | 
| name | <code>String</code> | 
| type | <code>String</code> | 


* * *

<a name="Query.Parameter"></a>

### Query.Parameter
**Kind**: static typedef of [<code>Query</code>](#Query)  
**Properties**

| Name | Type |
| --- | --- |
| output | <code>Boolean</code> | 
| type | [<code>TDSType</code>](#Query.TDSType) | 
| value | <code>\*</code> | 
| options | <code>Object</code> | 
| options.length | <code>Number</code> | 
| options.precision | <code>Number</code> | 
| options.scale | <code>Number</code> | 


* * *

<a name="Rhino"></a>

## Rhino
Rhino is a managed Microsoft SQL Server driver powered by tedious and node-pool. This class defines functionality
to execute queries and utlize transactions. Under the hood it handles all connection pooling, including opening
and closing of connections to the database. 

You can use multiple instances of the Rhino class in your application - each one can utilize a different 
configuration.

**Kind**: global class  

* [Rhino](#Rhino)
    * [new Rhino([config])](#new_Rhino_new)
    * _instance_
        * [.config](#Rhino+config) : [<code>RhinoConfiguration</code>](#Rhino.RhinoConfiguration)
        * [.log](#Rhino+log) : [<code>Log</code>](#Log)
        * [.destroy([done])](#Rhino+destroy)
        * [.ping()](#Rhino+ping) ⇒ <code>Boolean</code>
        * [.query(sql)](#Rhino+query) ⇒ [<code>ConnectedQuery</code>](#ConnectedQuery) \| <code>Promise.&lt;Result&gt;</code>
    * _static_
        * [.create([config])](#Rhino.create) ⇒ [<code>Rhino</code>](#Rhino)
        * [.defaultConfig([config])](#Rhino.defaultConfig) ⇒ <code>RhinoConfiguration</code>
        * [.PoolConfiguration](#Rhino.PoolConfiguration)
        * [.RhinoBaseConfiguration](#Rhino.RhinoBaseConfiguration)
        * [.RhinoConfiguration](#Rhino.RhinoConfiguration) : [<code>TediousConfiguration</code>](#Connection.TediousConfiguration) \| [<code>RhinoBaseConfiguration</code>](#Rhino.RhinoBaseConfiguration)


* * *

<a name="new_Rhino_new"></a>

### new Rhino([config])
Constructs a `Rhino` instance using the specified `config` values.


| Param | Type | Description |
| --- | --- | --- |
| [config] | [<code>RhinoConfiguration</code>](#Rhino.RhinoConfiguration) | Configuration values to use in this `Rhino` instance. Any properties not explicitly specified will use the default values. |


* * *

<a name="Rhino+config"></a>

### rhino.config : [<code>RhinoConfiguration</code>](#Rhino.RhinoConfiguration)
**Kind**: instance property of [<code>Rhino</code>](#Rhino)  

* * *

<a name="Rhino+log"></a>

### rhino.log : [<code>Log</code>](#Log)
**Kind**: instance property of [<code>Rhino</code>](#Rhino)  

* * *

<a name="Rhino+destroy"></a>

### rhino.destroy([done])
Destroys internal pooled resources in this instance. This is called automatically when the process exits.

**Kind**: instance method of [<code>Rhino</code>](#Rhino)  

| Param | Type | Description |
| --- | --- | --- |
| [done] | <code>function</code> | Callback function when the destruction is complete. |


* * *

<a name="Rhino+ping"></a>

### rhino.ping() ⇒ <code>Boolean</code>
Attempts to connect to the database. This method utilizes the internal connection pool, and will return `true`
if a connection is already opened and active. If the connection cannot be established for any reason, including
an error, a `false` is returned.

Note that if an error occurs in this function call, it is *not* thrown, but it will be logged normally.

**Kind**: instance method of [<code>Rhino</code>](#Rhino)  
**Returns**: <code>Boolean</code> - Returns `true` when a connection was successfully aquired. A `false` value is returned if the
connection cannot be aquired for any reason.  

* * *

<a name="Rhino+query"></a>

### rhino.query(sql) ⇒ [<code>ConnectedQuery</code>](#ConnectedQuery) \| <code>Promise.&lt;Result&gt;</code>
Runs a SQL statement on the database and returns the results.

**Kind**: instance method of [<code>Rhino</code>](#Rhino)  

| Param | Type | Description |
| --- | --- | --- |
| sql | <code>String</code> | The SQL statement to execute. |


* * *

<a name="Rhino.create"></a>

### Rhino.create([config]) ⇒ [<code>Rhino</code>](#Rhino)
This function creates a new `Rhino` instance to act as a pool for executing database queries. You can create
multiple `Rhino` instances to manage multiple pools of connections or for different databases.

**Kind**: static method of [<code>Rhino</code>](#Rhino)  

| Param | Type | Description |
| --- | --- | --- |
| [config] | <code>RhinoConfiguration</code> | Configuration values to use in this `Rhino` instance. Any properties not explicitly specified will use the default values. |

**Example**  
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

* * *

<a name="Rhino.defaultConfig"></a>

### Rhino.defaultConfig([config]) ⇒ <code>RhinoConfiguration</code>
Returns a default `RhinoConfiguration` object. Default values are first searched for in environmental variables
then, if not found, with hard-coded default values.

**Kind**: static method of [<code>Rhino</code>](#Rhino)  

| Param | Type | Description |
| --- | --- | --- |
| [config] | <code>RhinoConfiguration</code> | Optional configuration value overrides. |


* * *

<a name="Rhino.PoolConfiguration"></a>

### Rhino.PoolConfiguration
Please refer to:  [Tarn on GitHub](https://github.com/Vincit/tarn.js)

**Kind**: static typedef of [<code>Rhino</code>](#Rhino)  
**Properties**

| Name | Type | Default |
| --- | --- | --- |
| [max] | <code>Number</code> | <code>1</code> | 
| [min] | <code>Number</code> | <code>0</code> | 
| [acquireTimeoutMillis] | <code>Number</code> | <code>30000</code> | 
| [createTimeoutMillis] | <code>Number</code> | <code>30000</code> | 
| [idleTimeoutMillis] | <code>Number</code> | <code>30000</code> | 
| [reapIntervalMillis] | <code>Number</code> | <code>1000</code> | 
| [createRetryIntervalMillis] | <code>Number</code> | <code>200</code> | 


* * *

<a name="Rhino.RhinoBaseConfiguration"></a>

### Rhino.RhinoBaseConfiguration
**Kind**: static typedef of [<code>Rhino</code>](#Rhino)  
**Properties**

| Name | Type |
| --- | --- |
| [pool] | [<code>PoolConfiguration</code>](#Rhino.PoolConfiguration) | 
| [logging] | [<code>LogConfiguration</code>](#Log.LogConfiguration) | 


* * *

<a name="Rhino.RhinoConfiguration"></a>

### Rhino.RhinoConfiguration : [<code>TediousConfiguration</code>](#Connection.TediousConfiguration) \| [<code>RhinoBaseConfiguration</code>](#Rhino.RhinoBaseConfiguration)
Rhino's configuration fully implements all configuration properties from `tedious`.

**Kind**: static typedef of [<code>Rhino</code>](#Rhino)  
**See**

- [Tedious](http://tediousjs.github.io/tedious/api-connection.html#function_newConnection)
- [Tarn](https://github.com/Vincit/tarn.js)


* * *

<a name="Transaction"></a>

## Transaction
**Kind**: global class  

* [Transaction](#Transaction)
    * [new Transaction(pool)](#new_Transaction_new)
    * [.pool](#Transaction+pool) : <code>tarn.Pool</code>
    * [.queries](#Transaction+queries) : [<code>Array.&lt;Query&gt;</code>](#Query)
    * [.query(sql)](#Transaction+query) ⇒ [<code>ConnectedQuery</code>](#ConnectedQuery) \| <code>Promise.&lt;Result&gt;</code>
    * [.savePoint()](#Transaction+savePoint)
    * [.clear()](#Transaction+clear)
    * [.commit([txName], [isolation])](#Transaction+commit) ⇒ <code>Array.&lt;Result&gt;</code>
    * [.rollback()](#Transaction+rollback)


* * *

<a name="new_Transaction_new"></a>

### new Transaction(pool)
Creates a new instance of a `Transaction`.


| Param | Type | Description |
| --- | --- | --- |
| pool | <code>tarn.Pool</code> | The connection pool to utilize for aquiring the connection. |


* * *

<a name="Transaction+pool"></a>

### transaction.pool : <code>tarn.Pool</code>
The `tarn.Pool` instance linked to this query.

**Kind**: instance property of [<code>Transaction</code>](#Transaction)  

* * *

<a name="Transaction+queries"></a>

### transaction.queries : [<code>Array.&lt;Query&gt;</code>](#Query)
**Kind**: instance property of [<code>Transaction</code>](#Transaction)  

* * *

<a name="Transaction+query"></a>

### transaction.query(sql) ⇒ [<code>ConnectedQuery</code>](#ConnectedQuery) \| <code>Promise.&lt;Result&gt;</code>
Runs a SQL statement on the database and returns the results.

**Kind**: instance method of [<code>Transaction</code>](#Transaction)  

| Param | Type | Description |
| --- | --- | --- |
| sql | <code>String</code> | The SQL statement to execute. |


* * *

<a name="Transaction+savePoint"></a>

### transaction.savePoint()
Add a save-point to the transaction. This will follow the previously added query.

**Kind**: instance method of [<code>Transaction</code>](#Transaction)  
**Throws**:

- Error if no queries are present. A save-point should follow at least one query.


* * *

<a name="Transaction+clear"></a>

### transaction.clear()
Remove all queued queries from the transaction.

**Kind**: instance method of [<code>Transaction</code>](#Transaction)  

* * *

<a name="Transaction+commit"></a>

### transaction.commit([txName], [isolation]) ⇒ <code>Array.&lt;Result&gt;</code>
Commits all queries in the transaction queue.

**Kind**: instance method of [<code>Transaction</code>](#Transaction)  
**Throws**:

- Error if the `pool` property is falsey.
- Error when a `txName` argument is not present and an `isolation` argument is specified.

**See**

- [Microsoft documentation on transaction isolation levels.](https://docs.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql)
- `Connection.TediousConfiguration.options.isolationLevel`
- `Connection.TediousConfiguration.options.connectionIsolationLevel`


| Param | Type | Description |
| --- | --- | --- |
| [txName] | <code>String</code> | = A name associated with the transaction - this is required when specifying an  `isolation` argument value. |
| [isolation] | <code>tedious.ISOLATION\_LEVEL</code> \| <code>Number</code> \| <code>String</code> | The isolation level of the transaction. Values can be numbers or strings corresponding to the `Transaction.ISOLATION_LEVEL` enum. For example:   - READ_UNCOMMITTED - READ_COMMITTED - REPEATABLE_READ - SERIALIZABLE - SNAPSHOT Defaults to the connection's isolation level, which is *usually* "READ_COMMITED". |


* * *

<a name="Transaction+rollback"></a>

### transaction.rollback()
Rolls back the active transaction.

**Kind**: instance method of [<code>Transaction</code>](#Transaction)  
**Throws**:

- Error if the `pool` property is falsey.
- Error if there is no active transaction connection.


* * *

<a name="PromiseQuery"></a>

## PromiseQuery : [<code>Query</code>](#Query) \| <code>Promise.&lt;Result&gt;</code>
**Kind**: global typedef  

* * *


# Project Maintenance

## Unit Testing
Unit-testing this driver requires a Microsoft SQL Server instance.
Due to the fragile nature of the database unit-testing, and to avoid collisions with other users, it's recommended
to use the process described below ([docker](https://www.docker.com/products/docker-engine) is required).

### 1. Build the image.
To get started, build our testing docker image:
```
docker build ./test --build-arg SA_PASSWORD="YourStr0ng_PasswordHERE" -t rhino:test
```

### 2. Run the container.
You need to run the `rhino:test` container from the built image. This will spin up the server and run the install 
script. It is usually ideal to run the container in daemon mode (`-d`), as the container will stay alive until stopped.

```
docker run -d -p 1433:1433 rhino:test
```

When run using the command above, the docker server will be accessible on localhost port 1433.

### 3. Setup testing environment.
Configure a `.env` file in the root project folder and define the variables for connecting:
```
RHINO_MSSQL_HOST = localhost
RHINO_MSSQL_USER = sa
RHINO_MSSQL_PASSWORD = YourStr0ng_PasswordHERE
RHINO_MSSQL_DATABASE = Rhino_Test
```

### 4. Run tests.
Now that the test database server is up and running, you can run the Rhino unit-tests:

```
npm test
```

#### Troubleshooting
You can view the container logs to see the output from the server, including any runtime failures.

##### Show the running containers:
```
docker container ls
```

##### Show the output from a container:
```
docker container logs {container ID or Name here}
```

## Updating the API/Readme
The `README.md` file in this project is generated using the `js-to-markdown` package, essentially merging the JSdoc 
output into the `README.hbs` handlebars template file.

To rebuild the `README.md` file, simply run:
```
npm run doc
```

## Issues / Requests / Contributing
Please utilize the [issues](issues/) on the project to report a problem or provide feedback. Additional contributors are welcome.

1. Make sure the issue is with `rhino` and *not* the [tedious](https://github.com/tediousjs/tedious/issues) package. 
2. Gather details, your node and `rhino` version.
3. Provide as much information as possible, including steps to reporoduce the issue. Or better yet, provide a resolution with a merge request.
