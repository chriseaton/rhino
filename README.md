![Rhino](./rhino.png)

# Rhino

> !!New project - not ready yet!

Rhino is a tough, production-focused Node.js Microsoft SQL Server driver that incorporates pooling and is powered by
the [tedious](http://tediousjs.github.io/tedious/api-connection.html#function_newConnection) driver. 

Here's why Rhino is a solid choice:
- Purposefully uses very few dependencies.
- Solid, modern, unit-tested implementation built for heavy production use. 
- Employs async/await/Promise operations to keep your queries running quickly.
- Manages connections for you using an internal pool, tested with up to 10,000 simultaneous connections. 
  Stop worrying about connections and just build queries.
- Open-source and accepting positive contributions.

## Installation

```sh
npm i rhino --save
```

## Quick Start

```js
const rhino = require('rhino');

...
let dbc = await rhino.create({
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
let results = await dbc.query('SELECT * FROM dbo.People');
console.log(`Count: ${results.count}`);
console.log(results.rows);
dbc.destroy(); 
```

### Transactions

```js
    let tx = null;
    try {
        tx = await dbc.transaction();
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
# API 

## Classes

<dl>
<dt><a href="#EventTracker">EventTracker</a></dt>
<dd><p>Provides tooling to easily track event listeners and remove them from <code>EventEmitter</code> instances without affecting 
listeners added from other operations.</p>
</dd>
<dt><a href="#Log">Log</a></dt>
<dd><p>This logging class utilizes 3 modes of logging: error, warn, and debug.
The mode can be set by specifying one of the modes in the <code>RHINO_LOGGING</code> environmental variable, or through a
<code>rhino</code> instance&#39;s <code>config.logging.mode</code> property.</p>
</dd>
<dt><a href="#Rhino">Rhino</a></dt>
<dd><p>Rhino is a managed Microsoft SQL Server driver powered by tedious and node-pool. This class defines functionality
to execute queries and utlize transactions. Under the hood it handles all connection pooling, including opening
and closing of connections to the database. </p>
<p>You can use multiple instances of the Rhino class in your application - each one can utilize a different 
configuration.</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#TediousConfiguration">TediousConfiguration</a></dt>
<dd><p>The tedious configuration options are all fully supported. Some options support default values from environmental
variables, all of which use the <code>RHINO_MSSQL_</code> prefix.
For more details, please refer to: <a href="http://tediousjs.github.io/tedious/api-connection.html#function_newConnection">Tedious on GitHub</a></p>
</dd>
<dt><a href="#PoolConfiguration">PoolConfiguration</a></dt>
<dd><p>Please refer to:  <a href="https://github.com/Vincit/tarn.js">Tarn on GitHub</a></p>
</dd>
<dt><a href="#LogConfiguration">LogConfiguration</a></dt>
<dd></dd>
<dt><a href="#RhinoBaseConfiguration">RhinoBaseConfiguration</a></dt>
<dd></dd>
<dt><a href="#RhinoConfiguration">RhinoConfiguration</a> : <code><a href="#TediousConfiguration">TediousConfiguration</a></code></dt>
<dd><p>Rhino&#39;s configuration fully implements all configuration properties from <code>tedious</code>.</p>
</dd>
</dl>

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
    * [.config](#Log+config) : [<code>LogConfiguration</code>](#LogConfiguration)
    * [.error()](#Log+error)
    * [.warn()](#Log+warn)
    * [.debug()](#Log+debug)


* * *

<a name="Log+config"></a>

### log.config : [<code>LogConfiguration</code>](#LogConfiguration)
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
        * [.config](#Rhino+config) : [<code>RhinoConfiguration</code>](#RhinoConfiguration)
        * [.log](#Rhino+log) : [<code>Log</code>](#Log)
        * [.destroy([done])](#Rhino+destroy)
        * [.ping()](#Rhino+ping) ⇒ <code>Boolean</code>
    * _static_
        * [.create([config])](#Rhino.create) ⇒ [<code>Rhino</code>](#Rhino)
        * [.defaultConfig()](#Rhino.defaultConfig) ⇒ [<code>RhinoConfiguration</code>](#RhinoConfiguration)


* * *

<a name="new_Rhino_new"></a>

### new Rhino([config])
Constructs a `Rhino` instance using the specified `config` values.


| Param | Type | Description |
| --- | --- | --- |
| [config] | [<code>RhinoConfiguration</code>](#RhinoConfiguration) | Configuration values to use in this `Rhino` instance. Any properties not explicitly specified will use the default values. |


* * *

<a name="Rhino+config"></a>

### rhino.config : [<code>RhinoConfiguration</code>](#RhinoConfiguration)
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

<a name="Rhino.create"></a>

### Rhino.create([config]) ⇒ [<code>Rhino</code>](#Rhino)
This function creates a new `Rhino` instance to act as a pool for executing database queries. You can create
multiple `Rhino` instances to manage multiple pools of connections or for different databases.

**Kind**: static method of [<code>Rhino</code>](#Rhino)  

| Param | Type | Description |
| --- | --- | --- |
| [config] | [<code>RhinoConfiguration</code>](#RhinoConfiguration) | Configuration values to use in this `Rhino` instance. Any properties not explicitly specified will use the default values. |

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

### Rhino.defaultConfig() ⇒ [<code>RhinoConfiguration</code>](#RhinoConfiguration)
Returns a default `RhinoConfiguration` object. Default values are first searched for in environmental variables
then, if not found, with hard-coded default values.

**Kind**: static method of [<code>Rhino</code>](#Rhino)  

* * *

<a name="CONNECTION_STATE"></a>

## CONNECTION\_STATE : <code>enum</code>
**Kind**: global enum  
**Read only**: true  
**Properties**

| Name | Type | Default |
| --- | --- | --- |
| IDLE | <code>Number</code> | <code>1</code> | 
| CONNECTING | <code>Number</code> | <code>2</code> | 
| DISCONNECTING | <code>Number</code> | <code>4</code> | 
| TRANSACTING | <code>Number</code> | <code>8</code> | 
| EXECUTING | <code>Number</code> | <code>16</code> | 


* * *

<a name="TediousConfiguration"></a>

## TediousConfiguration
The tedious configuration options are all fully supported. Some options support default values from environmental
variables, all of which use the `RHINO_MSSQL_` prefix.
For more details, please refer to: [Tedious on GitHub](http://tediousjs.github.io/tedious/api-connection.html#function_newConnection)

**Kind**: global typedef  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [server] | <code>String</code> | <code>&quot;localhost&quot;</code> | A default value is checked for under the `RHINO_MSSQL_HOST` then `RHINO_MSSQL_SERVER` environmental variables. |
| [options] | <code>Object</code> |  |  |
| [options.port] | <code>Number</code> | <code>1433</code> | A default value is checked for under the `RHINO_MSSQL_PORT` environmental variable. |
| [options.instanceName] | <code>String</code> | <code></code> | A default value is checked for under the `RHINO_MSSQL_INSTANCE` then `RHINO_MSSQL_INSTANCE_NAME` environmental variables. |
| [options.database] | <code>String</code> | <code>&quot;master&quot;</code> | A default value is checked for under the `RHINO_MSSQL_DATABASE` environmental variable. |
| [options.appName] | <code>String</code> | <code>&quot;Tedious&quot;</code> | A default value is checked for under the `RHINO_MSSQL_APP_NAME` environmental variable. |
| [options.connectTimeout] | <code>Number</code> | <code>15000</code> |  |
| [options.requestTimeout] | <code>Number</code> | <code>15000</code> |  |
| [options.cancelTimeout] | <code>Number</code> | <code>5000</code> |  |
| [options.connectionRetryInterval] | <code>Number</code> | <code>500</code> |  |
| [options.encrypt] | <code>Boolean</code> | <code>false</code> | A default value is checked for under the `RHINO_MSSQL_ENCRYPT` environmental variable. |
| [authentication] | <code>Object</code> |  |  |
| [authentication.type] | <code>String</code> | <code>&quot;default&quot;</code> | A default value is checked for under the `RHINO_MSSQL_AUTH_TYPE` environmental variable. |
| [authentication.options] | <code>Object</code> |  |  |
| [authentication.options.userName] | <code>String</code> |  | A default value is checked for under the `RHINO_MSSQL_USER` then `RHINO_MSSQL_AUTH_USER` environmental variables. |
| [authentication.options.password] | <code>String</code> |  | A default value is checked for under the `RHINO_MSSQL_PASSWORD` then `RHINO_MSSQL_AUTH_PASSWORD` environmental variables. |
| [authentication.options.domain] | <code>String</code> |  | A default value is checked for under the `RHINO_MSSQL_DOMAIN` then `RHINO_MSSQL_AUTH_DOMAIN` environmental variables. |
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


* * *

<a name="PoolConfiguration"></a>

## PoolConfiguration
Please refer to:  [Tarn on GitHub](https://github.com/Vincit/tarn.js)

**Kind**: global typedef  
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

<a name="LogConfiguration"></a>

## LogConfiguration
**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| mode | <code>Boolean</code> \| <code>String</code> | Can be 'none', 'error', 'warn', or 'debug for enabled logging levels. A falsey value will disable logging. A truthy value that is not a string will assume 'warn' mode. |


* * *

<a name="RhinoBaseConfiguration"></a>

## RhinoBaseConfiguration
**Kind**: global typedef  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [pool] | [<code>PoolConfiguration</code>](#PoolConfiguration) |  |  |
| [logging] | [<code>LogConfiguration</code>](#LogConfiguration) |  |  |
| [connectionRetries] | <code>Number</code> | <code>3</code> | The number of attempts to connect should the first connection attempt  fail due to socket/network errors (ESOCKET). Other errors, such as those related to authentication are *not* retried. |


* * *

<a name="RhinoConfiguration"></a>

## RhinoConfiguration : [<code>TediousConfiguration</code>](#TediousConfiguration)
Rhino's configuration fully implements all configuration properties from `tedious`.

**Kind**: global typedef  
**See**

- [Tedious](http://tediousjs.github.io/tedious/api-connection.html#function_newConnection)
- [Tarn](https://github.com/Vincit/tarn.js)


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
