const _ = require('lodash');

module.exports = {
  loadDataSources: (app) => {
    // Error handling for VCAP_SERVICES absence
    console.log(process.env.VCAP_SERVICES);
    if (!process.env.VCAP_SERVICES) 
      throw new Error('VCAP_SERVICES environment variable is not set!');

    const vcap = JSON.parse(process.env.VCAP_SERVICES);

    const userProvidedServices = vcap['user-provided'] || []; // Handle missing service group

    // Find Cloudant and dashDB services using more robust filtering
    const cloudant = userProvidedServices.find(
      (service) => service.name.toLowerCase().includes('cloudant')
    );

    const dashDB = userProvidedServices.find(
      (service) => service.name.toLowerCase().includes('dashdb')
    );

    // Error handling for missing services
    if (!cloudant) {
      throw new Error('Cloudant service not found in VCAP_SERVICES!');
    }

    if (!dashDB) {
      throw new Error('dashDB service not found in VCAP_SERVICES!');
    }

    const cloudantCredentials = cloudant.credentials;
    const dashDBCredentials = dashDB.credentials;

    // Data source configuration with potential improvements
    app.dataSource('dashDB', {
      minPoolSize: _.get(dashDBCredentials, 'minPoolSize'), // Use lodash.get for safer property access
      maxPoolSize: _.get(dashDBCredentials, 'maxPoolSize'),
      idleTimeout: _.get(dashDBCredentials, 'idleTimeout'),
      connectionTimeout: _.get(dashDBCredentials, 'connectionTimeout'),
      autoCleanIdle: _.get(dashDBCredentials, 'autoCleanIdle'),
      dsn: dashDBCredentials.ssldsn, // Assuming ssldsn is the correct property
      connector: 'dashdb',
    });

    app.dataSource('sessionDB', {
      url: cloudantCredentials.url,
      database: 'previous_sessions',
      username: cloudantCredentials.username,
      password: cloudantCredentials.password,
      name: 'sessionDB',
      modelIndex: 'lb_key',
      connector: 'cloudant',
    });

    app.dataSource('geoDB', {
      url: cloudantCredentials.url, // Assuming same Cloudant instance for all data sources
      database: 'geo_lots',
      username: cloudantCredentials.username,
      password: cloudantCredentials.password,
      name: 'geoDB',
      modelIndex: 'lb_key',
      connector: 'cloudant',
    });

    app.dataSource('planDB', {
      url: cloudantCredentials.url, // Assuming same Cloudant instance for all data sources
      database: 'plan_collateral',
      username: cloudantCredentials.username,
      password: cloudantCredentials.password,
      name: 'planDB',
      modelIndex: 'lb_key',
      connector: 'cloudant',
    });

    return app;
  },
};
