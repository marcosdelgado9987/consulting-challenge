if (!('VCAP_SERVICES' in process.env)) {
  require('dotenv').config({ path: process.env.ENVPATH }); // eslint-disable-line global-require
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const loopback = require('loopback');
const boot = require('loopback-boot');
const basicAuthParser = require('basic-auth');
const rp = require('request-promise-cache');
const DataSoucreLoader = require('./boot/datasoucre.loader');

let app = loopback();
module.exports = app;
app = DataSoucreLoader.loadDataSources(app);

const basicAuth = (req, res, next) => {
  if (req.url === '/healthcheck') {
    // Skip the authentication step
    return next();
  } else if (('X-HSO-Key' in req.headers || 'apikey' in req.query)) {
    const key = req.headers['X-HSO-Key'] || req.query.apikey;
    const url = 'https://apiconnect.ibmcloud.com/api/hs1/api/token';
    rp({
      method: 'GET',
      url,
      cacheKey: key,
      cacheTTL: 86400000,
      cacheLimit: 15,
      json: true,
      headers: { 'X-HSO-Key': key },
    }).then((message) => {
      if (message.active) next();
      else {
        res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
        res.sendStatus(401);
      }
    }).catch(() => {
      res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
      res.sendStatus(401);
    });
  } else {
    const user = basicAuthParser(req);
    const validUser = user && user.name === 'Consulting' && user.pass === 'Ch@lleng3';

    if (!validUser) {
      res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
      res.sendStatus(401);
    } else next();
  }
};

app.start = () => app.listen(() => {
  app.emit('started');
  const baseUrl = app.get('url').replace(/\/$/, '');
  console.log('Web server listening at: %s', baseUrl); // eslint-disable-line no-console
  if (app.get('loopback-component-explorer')) {
    const explorerPath = app.get('loopback-component-explorer').mountPath;
    console.log('Browse your REST API at %s%s', baseUrl, explorerPath); // eslint-disable-line no-console
  }
});

app.use(basicAuth);

app.get('/report/:areaId/from/:start/to/:end', (req, res) => {
  const Sessions = app.models.sessions;
  Sessions.genReportStream(req.params.areaId, req.params.start, req.params.end, (err, stream) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=report.pdf');
    stream.pipe(res);
  });
});

// health check
app.get(`/healthcheck`,
  function(req, res) {
    res.status(200).send("Healthy");
  }
);

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, (err) => {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module) app.start();
});
