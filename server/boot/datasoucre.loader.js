const _ = require('lodash');

module.exports = {
  loadDataSources: (app) => {
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    const cloudantIndex = _.findIndex(vcap['user-provided'], x => /cloudant/gi.test(x.name));
    const cloudant = vcap['user-provided'][cloudantIndex].credentials;
    const dashDBIndex = _.findIndex(vcap['user-provided'], x => /dashDB/gi.test(x.name));
    const dashDB = vcap['user-provided'][dashDBIndex].credentials;

    app.dataSource('dashDB', {
      minPoolSize: dashDB.minPoolSize,
      maxPoolSize: dashDB.maxPoolSize,
      idleTimeout: dashDB.idleTimeout,
      connectionTimeout: dashDB.connectionTimeout,
      autoCleanIdle: dashDB.autoCleanIdle,
      dsn: dashDB.ssldsn,
      connector: 'dashdb',
    });

    // Previous sessions
    app.dataSource('sessionDB', {
      url: cloudant.url,
      database: 'previous_sessions',
      username: cloudant.username,
      password: cloudant.password,
      name: 'sessionDB',
      modelIndex: 'lb_key',
      connector: 'cloudant',
    });

    // Previous sessions
    app.dataSource('geoDB', {
      url: cloudant.url,
      database: 'geo_lots',
      username: cloudant.username,
      password: cloudant.password,
      name: 'geoDB',
      connector: 'cloudant',
      modelIndex: 'lb_key',
    });

    // Previous sessions
    app.dataSource('planDB', {
      url: cloudant.url,
      database: 'plan_collateral',
      username: cloudant.username,
      password: cloudant.password,
      name: 'planDB',
      modelIndex: 'lb_key',
      connector: 'cloudant',
    });
    return app;
  },
};
