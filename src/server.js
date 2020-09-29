/* Node-DataTables
 * https://github.com/jareddlc/Node-DataTables
 * this is a copy of the server side script located at: http://datatables.net/release-datatables/examples/data_sources/server_side.html
 * Fill in the MySQL information below
 */

//------------------------- Setup
//---MySQL
var mysql = require('mysql');
const util = require('util');
var sIndexColumn = '*';
var sTable = 'FINV';
var connection = mysql.createConnection({
  host: 'tuvansa.dyndns.org',
  user: 'consultas',
  password: 'consultas',
  database: 'tuvansa'
});

// MySQL 2 coneccion
var connection2 = mysql.createConnection({
  host: 'tuvansa-server.dyndns.org',
  user: 'erick',
  password: 'Ag7348pp**',
  database: 'tuvansa'
})

connection2.connect(err =>{
  if(err) throw err;

  console.log('Conectado prrro!!')
})

const query = util.promisify(connection2.query).bind(connection2);


//moment
const moment = require('moment');
const mes = String(moment().format('M'))
const anio = String(moment().format('Y'))
let ultimoDiaMes = moment().endOf('month').format('D');

setInterval(() => {
  creaColumnaAFinDeMes()
}, 60000)





/* function handleDisconnect(connection) {
  connection.on('error', function (err) {
    if (!err.fatal) {
      return;
    }
    if (err.code !== 'PROTOCOL_CONNECTION_LOST') {
      throw err;
    }
    connection.end();
    console.log('\nRe-connecting lost connection: ' + err.stack);
    console.log(connection.config);

    setTimeout(function () {
      connection = mysql.createConnection(connection.config);
      handleDisconnect(connection);
      connection.connect();
    }, 1000); // 1 sec
  });
}

handleDisconnect(connection); */


console.log('Server initilizing...');

//---ExpressJS
var express = require('express');
const { exit } = require('process');
var app = express();

//---Middleware: Allows cross-domain requests (CORS)
var allowCrossDomain = function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
}

//---App config
app.configure(function () {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'secret' }));
  app.use(express.methodOverride());
  app.use(allowCrossDomain);
  app.use(app.router);
});

//---Global vars
var request = {};
var aColumns = ['FINV.ISEQ', 'ICOD', 'IEAN', 'I2DESCR', ' DATE_FORMAT(IALTA,"%Y-%m-%d")', 'ALMCANT', 'ALMNUM'];

//------------------------- Endpoints
app.get('/server', function (req, res, next) {

  console.log('GET request to /server');
  request = req.query;
  server(res);
})

app.post('/data', function (req, res) {


  let data = req.body;
  let fechaActual = moment().format('YYYY-MM-DD')

  let inventarios = {
    'ISEQ': data.id,
    'ICOD': data.codigo,
    'IEAN': data.ean,
    'I2DESCR': data.descripcion,
    'IALTA': data.fecha,
    'ALMCANT': data.inventarioProscai,
    'IALTAREAL': fechaActual,
    'ALMCANTREAL': data.value,
  };



  (async () => {


    let busca = await query(`SELECT * FROM inventarios WHERE ISEQ = ${inventarios.ISEQ}`);

    if (busca.length <= 0) {
      let insert = await query('INSERT INTO inventarios SET ?', inventarios)
    } else {
      let actualiza = await query('UPDATE inventarios SET ALMCANTREAL = ?, IALTAREAL = ? WHERE ISEQ = ? ', [inventarios.ALMCANTREAL, inventarios.IALTAREAL, inventarios.ISEQ]);
    }


  })();


})

app.listen(8888);
console.log('Express server started on port 8888');

//------------------------- Functions
function server(res) {
  //Paging
  var sLimit = "";
  if (request['iDisplayStart'] && request['iDisplayLength'] != -1) {
    sLimit = 'LIMIT ' + request['iDisplayStart'] + ', ' + request['iDisplayLength']
  }

  //Ordering
  var sOrder = "";
  if (request['iSortCol_0']) {
    sOrder = 'ORDER BY ';

    for (var i = 0; i < request['iSortingCols']; i++) {
      if (request['bSortable_' + parseInt(request['iSortCol_' + i])] == "true") {
        sOrder += aColumns[parseInt(request['iSortCol_' + i])] + " " + request['sSortDir_' + i] + ", ";
      }
    }

    sOrder = sOrder.substring(0, sOrder.length - 2)
    if (sOrder == 'ORDER BY') {
      console.log("sOrder == ORDER BY");
      sOrder = "";
    }
  }

  //Filtering
  var sWhere = "";
  if (request['sSearch'] && request['sSearch'] != "") {
    let busqueda = request['sSearch'].toUpperCase();
    sWhere = "WHERE (";
    for (var i = 0; i < aColumns.length; i++) {
      sWhere += aColumns[i] + " LIKE " + "\'%" + busqueda + "%\'" + " OR ";
    }

    sWhere = sWhere.substring(0, sWhere.length - 4);
    sWhere += ')';
  }

  //Individual column filtering
  for (var i = 0; i < aColumns.length; i++) {
    if (request['bSearchable_' + i] && request['bSearchable_' + i] == "true" && request['sSearch_' + i] != '') {
      if (sWhere == "") {
        sWhere = "WHERE ";
      }
      else {
        sWhere += " AND ";
      }
      sWhere += " " + aColumns[i] + " LIKE " + request['sSearch_' + i] + " ";
    }
  }

  //Queries
  //var sQuery = "SELECT SQL_CALC_FOUND_ROWS " +aColumns.join(',')+ " FROM " +sTable+" "+sWhere+" "+sOrder+" "+sLimit +" limit 10";
  var sQuery = `SELECT SQL_CALC_FOUND_ROWS  ${aColumns.join(',')} FROM   ${sTable} LEFT JOIN FALM ON FALM.ISEQ=FINV.ISEQ LEFT JOIN FINV2 ON FINV2.I2KEY=FINV.ISEQ ${sWhere} ${sOrder} ${sLimit}  `;

  var rResult = {};
  var rResultFilterTotal = {};
  var aResultFilterTotal = {};
  var iFilteredTotal = {};
  var iTotal = {};
  var rResultTotal = {};
  var aResultTotal = {};

  let q = connection.query(sQuery, function selectCb(err, results, fields) {
    if (err) {
      console.log(err);
    }

    rResult = results;

    //Data set length after filtering 
    sQuery = "SELECT FOUND_ROWS()";

    q = connection.query(sQuery, function selectCb(err, results, fields) {
      if (err) {
        console.log(err);
      }

      rResultFilterTotal = results;
      aResultFilterTotal = rResultFilterTotal;
      iFilteredTotal = aResultFilterTotal[0]['FOUND_ROWS()'];

      //Total data set length 
      sQuery = "SELECT COUNT(" + sIndexColumn + ") FROM " + sTable;

      connection.query(sQuery, function selectCb(err, results, fields) {
        if (err) {
          console.log(err);
        }
        rResultTotal = results;
        aResultTotal = rResultTotal;
        iTotal = aResultTotal[0]['COUNT(*)'];

        //Output
        var output = {};
        var temp = [];

        output.sEcho = parseInt(request['sEcho']);
        output.iTotalRecords = iTotal;
        output.iTotalDisplayRecords = iFilteredTotal;
        output.aaData = [];

        var aRow = rResult;
        var row = [];

        for (var i in aRow) {
          for (Field in aRow[i]) {
            if (!aRow[i].hasOwnProperty(Field)) continue;
            temp.push(aRow[i][Field]);

          }

          output.aaData.push(temp);




          temp = [];
        }

        agregaInventarioRealDBTuvansaAdataTable(output)
          .then(resp => sendJSON(res, 200, resp))



      });
    });
  });
}



function sendJSON(res, httpCode, body) {
  var response = JSON.stringify(body);
  res.send(httpCode, response);
}



async function agregaInventarioRealDBTuvansaAdataTable(output) {

  const out = await output;

  for (const data of out.aaData) {
    let inventarios = await query(`SELECT  * FROM inventarios WHERE iseq = ${data[0]}`);
    if (inventarios.length > 0) {
      data[7] = inventarios[0].ALMCANTREAL
    }
  }

  return out;

}

async function creaColumnaAFinDeMes() {

  console.log(moment().format('D h:mm a'))
  console.log(`la siquiente actualizacion sera el dia  ${ultimoDiaMes} de ${mes} de ${anio} a las 10:00 pm`)
  if (String(moment().format('D h:mm a')) === `24 1:47 pm`) {

    let buscaColumna = await query( 
      ` SELECT * FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'tuvansa' 
      AND TABLE_NAME = 'inventarios' AND COLUMN_NAME = 'ALMCANTREAL0${mes}${anio}' `
    )

    if (buscaColumna || buscaColumna.length > 0) {
      console.log('Ya existe la columna')
      return;
    }


    let crearColumna = await query(
      `ALTER TABLE inventarios
      ADD COLUMN ALMCANT0${mes}${anio} int(10),
      ADD COLUMN ALMCANTREAL0${mes}${anio} int(10), 
      ADD COLUMN IALTAREAL0${mes}${anio} date`
    );

    let inventarios = await query('SELECT ISEQ, ALMCANT,DATE_FORMAT(IALTAREAL,"%Y-%m-%d %H:%i:%S")  AS IALTAREAL ,ALMCANTREAL FROM inventarios ');

    for (const inventario of inventarios) {
      let data = {}
      data.iseq = inventario.ISEQ;
      data.almcant = inventario.ALMCANT;
      data.ialtareal = inventario.IALTAREAL;
      data.almcantreal = inventario.ALMCANTREAL;

      let queryInv = `
              UPDATE inventarios 
              SET  
              ALMCANT0${mes}${anio} = ${data.almcant},
              ALMCANTREAL0${mes}${anio} = ${data.almcantreal},
              IALTAREAL0${mes}${anio} = '${data.ialtareal}' 
              WHERE ISEQ = ${data.iseq}`

      let insertado = await query(queryInv);

      console.log(insertado);

    }





  } else {
    //console.log('No es la fecha')
  }

}