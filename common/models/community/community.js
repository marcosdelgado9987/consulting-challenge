const _ = require('lodash');

module.exports = (Community) => {
  /* GET active communities */
  Community.remoteMethod('active', {
    accepts: [],
    http: { path: '/active', verb: 'get' },
    returns: { arg: 'communityList', root: false, type: ['COMMUNITY'] },
  });

  /* GET all communities */
  Community.remoteMethod('allCommunities', {
    accepts: [],
    http: { path: '/allCommunities', verb: 'get' },
    returns: { arg: 'communityList', root: false, type: ['COMMUNITY'] },
  });

  Community.remoteMethod('distinctArea', {
    accepts: [],
    http: { path: '/area/distinct', verb: 'get' },
    returns: { root: true, type: 'array' },
  });

  Community.remoteMethod('getCommunity', {
    accepts: [
      { arg: 'id', type: 'string', required: true },
      { arg: 'phase', type: 'string', required: true },
    ],
    http: { path: '/id/:id/:phase', verb: 'get' },
    returns: { arg: 'communityList', type: ['COMMUNITY'] },
  });

  Community._matchInfo = (community, communityInfo) => {
    const modCommunity = community;
    const match = { communityId: modCommunity.id.trim(), areaId: modCommunity.areaId.trim() };
    const info = _.filter(communityInfo, match);
    if (!_.isUndefined(info)) {
      if (info.length > 1) {
        const matchedByPhase = _.filter(info, { phase: modCommunity.phase.trim() });
        const wildcardMatch = _.filter(info, i => i.phase.trim() === '+');
        if (matchedByPhase.length === 1) {
          modCommunity.communityinfo = matchedByPhase[0];
        } else if (wildcardMatch.length === 1) {
          modCommunity.communityinfo = wildcardMatch[0];
        }
      } else if (info.length === 1) {
        if (info[0].phase.trim() === community.phase.trim() || info[0].phase.trim() === '+') {
          modCommunity.communityinfo = info[0];
        }
      }
    }
    return community;
  };

  Community._getCommunityInfo = (data) => {
    const CommunityInfo = Community.app.models.COMMUNITYINFO;
    return CommunityInfo.find(data.where)
      .then((communityInfo) => {
        data.communityInfo = communityInfo;
        return data;
      });
  };

  Community._getInfoWhere = (data) => {
    if (_.isArray(data)) {
      return Promise.resolve({
        where: {},
        communityData: data,
      });
    }
    return Promise.resolve({
      where: {
        and: [
          { communityId: data.id },
          { areaId: data.areaId },
          { phase: data.phase },
          { phase: { like: '%+%' } },
        ],
      },
      community: data,
    });
  };

  Community.distinctArea = (cb) => {
    const dbConnector = Community.app.datasources.dashDB.connector;
    dbConnector.execute('SELECT DISTINCT AREA_ID FROM COMMUNITY', [], (err, data) => {
      if (err) cb(err);
      else cb(null, _.map(data, val => val.AREA_ID));
    });
  };

  Community.active = () => {
    const filter = {
      where: {
        and: [
          {
            neighborhoodStatus: { inq: ['Active', 'Grand Opening', 'Coming Soon', 'Closing Out'] },
          },
          {
            or: [
              {
                phaseEnabled: '1',
                phase: { neq: '000' },
              },
              {
                phaseEnabled: '0',
                phase: '000',
              },
            ],
          },
        ],
      },
    };
    return Community.find(filter)
      .then(Community._getInfoWhere)
      .then(Community._getCommunityInfo)
      .then(data => _.map(data.communityData,
        community => Community._matchInfo(community, data.communityInfo)));
  };

  Community.allCommunities = () => {
    const filter = {
      where: {
        or: [
          {
            phaseEnabled: '1',
            phase: { neq: '000' },
          },
          {
            phaseEnabled: '0',
            phase: '000',
          },
        ],
      },
    };
    return Community.find(filter)
      .then(Community._getInfoWhere)
      .then(Community._getCommunityInfo)
      .then(data => _.map(data.communityData,
        community => Community._matchInfo(community, data.communityInfo)));
  };

  Community.getCommunity = (id, phase) =>
    Community.findOne({ where: { id, phase } })
      .then(Community._getInfoWhere)
      .then(Community._getCommunityInfo)
      .then(data => [Community._matchInfo(data.community, data.communityInfo)]);
};
