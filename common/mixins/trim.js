const _ = require('lodash');

module.exports = (Model) => { // eslint-disable-line no-param-reassign
  Model.afterRemote('**', (ctx, data, next) => {
    const string = JSON.stringify(data).replace(/\s*\"/gi, '"'); // eslint-disable-line no-useless-escape
    let noSpaceData = JSON.parse(string); // eslint-disable-line no-param-reassign

    // Add type data?
    if (_.isObject(noSpaceData) && Object.keys(noSpaceData).length === 1) {
      _.forEach(noSpaceData, (valuesList, key) => {
        if (_.isArray(valuesList)) {
          valuesList = _.map(valuesList, (record) => { // eslint-disable-line no-param-reassign
            _.forEach(record, (value, valueKey) => {
              if (_.isString(value)) {
                const type = Model.getPropertyType(valueKey);
                if (type && type.toLowerCase() === 'number') {
                  value = parseFloat(value) || 0; // eslint-disable-line no-param-reassign
                }
              }
              record[valueKey] = value; // eslint-disable-line no-param-reassign
            });
            return record;
          });
          noSpaceData[key] = valuesList; // eslint-disable-line no-param-reassign
        }
      });
    } else if (_.isArray(noSpaceData)) {
      noSpaceData = _.map(noSpaceData, (record) => { // eslint-disable-line no-param-reassign
        _.forEach(record, (value, key) => {
          if (_.isString(value)) {
            const type = Model.getPropertyType(key);
            if (type && type.toLowerCase() === 'number') {
              value = parseFloat(value) || 0; // eslint-disable-line no-param-reassign
            }
          }
          record[key] = value; // eslint-disable-line no-param-reassign
        });
        return record;
      });
    }

    ctx.result = noSpaceData; // eslint-disable-line no-param-reassign
    next();
  });
};
