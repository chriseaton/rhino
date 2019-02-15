const rhino = require('./rhino.js');
require('jest');


test('preliminary', async () => {
    let pool = rhino.create({

    });
    let results = await pool.query('SELECT TOP 3 FROM dbo.Persons');
    console.log(results);
});