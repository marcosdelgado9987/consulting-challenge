const _ = require('lodash');
const async = require('async');
const moment = require('moment');
const rp = require('request-promise');

if(!('VCAP_SERVICES' in process.env))
  require('dotenv').config({path: process.env.ENVPATH});
var vcap = JSON.parse(process.env.VCAP_SERVICES);

module.exports = (Addendum) => {
  /* POST new Addendum */
  Addendum.disableRemoteMethodByName('create');
  Addendum.remoteMethod('createWithNextAddendumNumber', {
    accepts: [
      { arg: 'body', type: 'object', required: true, http: { source: 'body' } },
    ],
    http: { path: '/', verb: 'post' },
    returns: { arg: 'Addendum', type: ['ADDENDUM'] },
  });

  /* GET by contractId and addendumNumber */
  Addendum.disableRemoteMethodByName('findById');
  Addendum.remoteMethod('getByContractId', {
    accepts: [
      { arg: 'contractId', type: 'string', required: true },
    ],
    http: { path: '/:contractId', verb: 'get' },
    returns: { arg: 'addendumList', type: ['Addendum'] },
  });

  Addendum.remoteMethod('getByContractAndAddendum', {
    accepts: [
      { arg: 'contractId', type: 'string', required: true },
      { arg: 'addendumNumber', type: 'string', required: true },
    ],
    http: { path: '/:contractId/:addendumNumber', verb: 'get' },
    returns: { arg: 'addendumList', type: ['Addendum'] },
  });

  Addendum.remoteMethod('deleteByContractId', {
    accepts: [
      { arg: 'contractId', type: 'string', required: true },
    ],
    http: { path: 'contract/:contractId', verb: 'delete' },
    returns: { arg: 'addendumList', type: ['Addendum'] },
  });

  /* PUT envelope data into contract */
  Addendum.remoteMethod('updateAddendumWithEnvelope', {
    accepts: [
      { arg: 'contractId', type: 'string', required: true },
      { arg: 'addendumNumber', type: 'number', required: true },
      { arg: 'envelopeId', type: 'string', required: true },
      { arg: 'envelopeStatus', type: 'string', required: true },
    ],
    http: { path: '/:contractId/:addendumNumber/:envelopeId/:envelopeStatus', verb: 'put' },
    returns: { arg: 'addendum', type: 'object' },
  });

  Addendum.remoteMethod('removeByContractId', {
    accepts: [
      { arg: 'contractId', type: 'string', required: true },
    ],
    http: { path: '/contract/:contractId', verb: 'delete' },
    returns: { arg: 'addendumList', type: ['Addendum'] },
  });

  /* POST envelope Status */
  Addendum.remoteMethod('docusignPostback', {
    accepts: [
      { arg: 'body', type: 'object', http: { source: 'body' } },
    ],
    http: { path: '/docusign/postback', verb: 'post' },
    returns: { arg: 'addendum', type: 'object' },
  });

  /* POST envelope Status */
  Addendum.remoteMethod('processDocusignStatuses', {
    accepts: [
      { arg: 'body', type: 'array', http: { source: 'body' } },
    ],
    http: { path: '/cloud/function/postback', verb: 'post' },
    returns: { arg: 'addendum', type: 'object' },
  });

  Addendum.remoteMethod('restorePreviousContract', {
    accepts: [
      { arg: 'saveSession', type: 'object', http: { source: 'body' } },
    ],
    http: { path: '/sucker/punch', verb: 'post' },
    returns: { arg: 'addendum', type: 'object' },
  });

  Addendum.remoteMethod('getTotals', {
    accepts: [
      { arg: 'contractId', type: 'string', require: true },
    ],
    http: { path: '/totals/:contractId', verb: 'get' },
    returns: { type: 'object', root: true },
  });

  Addendum.remoteMethod('addLotCancelRecord', {
    accepts: [
      { arg: 'dsStatus', type: 'string', required: true },
      { arg: 'chainData', type: 'object', http: { source: 'body' } },
    ],
    http: { path: '/blah/test/:dsStatus', verb: 'post' },
    returns: { type: 'object', root: true },
  });

  Addendum.remoteMethod('findSessionByEnvelopId', {
    accepts: [
      { arg: 'envelopeId', type: 'string', required: true },
    ],
    http: { path: '/session/:envelope', verb: 'get' },
    returns: { type: 'object', root: true },
  });

  Addendum.remoteMethod('findSessionByContractAndAddendumNumber', {
    accepts: [
      { arg: 'contractId', type: 'string', required: true },
      { arg: 'addendumNumber', type: 'string', required: true },
    ],
    http: { path: '/session/:contractId/:addendumNumber', verb: 'get' },
    returns: { type: 'object', root: true },
  });

  Addendum.remoteMethod('refreshDocuSignStatuses', {
    accepts: [],
    http: { path: '/docusign/refreshStatuses', verb: 'post' },
    returns: { type: 'object', root: true },
  });


  Addendum.refreshDocuSignStatuses = (cb) => {
    const filter = { where: { or: [{ envelopeStatus: 'Sent' }, { envelopeStatus: 'Delivered' }]}};
    let envelopeIdArray = [];
    let dashStatusArray = [];

    Addendum.find(filter, (err, addendumObjects) => {
      if (err) {
        cb(err);
        return;
      }
      _.forEach(addendumObjects, (a) => {
        if(!_.isUndefined(a.envelopeId)){
          envelopeIdArray.push(a.envelopeId);
          dashStatusArray.push({envelopeId:a.envelopeId,envelopeStatus:a.envelopeStatus});
        }
      });
      var proxyIndex = _.findIndex(vcap['user-provided'], (x) => /ui-proxy/gi.test(x.name));
      var proxys = vcap['user-provided'][proxyIndex].credentials;
      var url = `${proxys.docusign.target}/docusign/envelope/statuses`;
      const config = {
        url: url,
        method: 'POST',
        headers: {
          "content-type": "application/json",
          "authorization": "Basic xxxxxxxxxxxx",
          "accept": "application/json",
        },
        body: JSON.stringify({ envelopeIds: envelopeIdArray }),
      };
      rp(config)
        .then((data) => {
          data = JSON.parse(data);
          async.eachLimit(dashStatusArray,1,function(s,outerNext){
            let dsFound = false;
            async.eachLimit(data.envelopes,1,function(e,innerNext){
              if(s.envelopeId==e.envelopeId){
                dsFound = true;
                let dsStatus = e.status;
                let dashStatus = s.envelopeStatus;
                let dsStatusFormatted = dsStatus.substr(0,1).toUpperCase()+dsStatus.substr(1).toLowerCase();
                let dashStatusFormatted = dashStatus.substr(0,1).toUpperCase()+dashStatus.substr(1).toLowerCase();
                if(dsStatusFormatted != dashStatusFormatted){
                  if(dsStatusFormatted == 'Voided' || dsStatusFormatted == 'Declined' || dsStatusFormatted == 'Sent'|| dsStatusFormatted == 'Delivered' ||(dashStatusFormatted!="Pushed" && dsStatusFormatted =="Completed")) {
                    let dummyPostback = {"DocuSignEnvelopeInformation":{"EnvelopeStatus":{"Status":dsStatusFormatted,"EnvelopeID": e.envelopeId}}};
                    Addendum.docusignPostback(dummyPostback, function (err, response) {
                      if (err) {
                        console.log(err);
                        console.log(`Warning: Error updating Document ${e.envelopeId}`);
                      } else {
                        console.log(`Success: Document ${e.envelopeId} has been updated from ${dashStatusFormatted} to ${dsStatusFormatted} in DASH.`);
                      };
                    });
                  }else{
                    console.log(`INFO: envelopeId found in Docusign, but with statuses of ${dashStatusFormatted} and ${dsStatusFormatted}, does not match a scenario to change: ${s.envelopeId}`);
                  };
                }else{
                  console.log(`INFO: envelopeId found in Docusign, but with statuses of ${dashStatusFormatted} and ${dsStatusFormatted}, no change required: ${s.envelopeId}`);
                };
              };
              setTimeout(function(){innerNext()},1000);
            });
            if(!dsFound){
              console.log(`INFO: envelopeId not found in Docusign: ${s.envelopeId}`);
              outerNext();
            } else {
              outerNext();
            }
          });
          cb(null,true); //TypeError: cb is not a function
      }).catch((err) => {
        console.error(err);
      });
    });
  };

  Addendum.processDocusignStatuses = (bodyArray, cb) => {
    const water = [(done) => done(null, [])]; // eslint-disable-line arrow-parens
    _.forEach(bodyArray, (body) => {
      water.push((data, done) => {
        Addendum.docusignPostback(body, (err, response) => {
          if (err) data.push(err);
          else data.push(response);
          done(null, data);
        });
      });
    });

    async.waterfall(water, cb);
  };

  Addendum._getNextNumberForAddendum = (body, cb) => {
    const nextFilter = { where: { contractId: body.contractId }, order: 'addendumNumber DESC' };
    Addendum.find(nextFilter, (err, data) => {
      if (err) cb(err);
      else {
        let newAddendumNumber = 1;
        if (data.length > 0) newAddendumNumber = data[0].addendumNumber + 1;
        cb(null, newAddendumNumber);
      }
    });
  };

  Addendum.createWithNextAddendumNumber = (body, cb) => {
    // Get next addendum number
    Addendum._getNextNumberForAddendum(body, (err, data) => {
      if (err) {
        console.log('CONTRACT ERRORED - Addendum.createWithNextAddendumNumber - addendum._getNextNumberForAddendum')
        cb(err, null);
      }else {
        body.addendumNumber = data;
        console.log('START createWithNextAddendumNumber')
        // Set addendum with addendum number
        Addendum.create(body, (createErr, addendumData) => {
          console.log('START ADDENDUM.CREATE')
          if (createErr) {
            console.log('CONTRACT ERRORED - Addendum.createWithNextAddendumNumber - addendum.create')

            cb(createErr, null)
          } else {
            const ContractHeader = Addendum.app.models.CONTRACTHEADER;
            ContractHeader.updateAll(
              { contractId: body.contractId },
              { currentTransactionNumber: body.addendumNumber },
              (headerErr) => {
                if (headerErr) {
                  console.log('CONTACT ERRORED - Addendum.createWithNextAddendumNumber - contrat header update')
                  cb(headerErr, null)
                } else if (body.addendumType === 'CAN' || body.addendumType === 'CLR') {
                  const Contract = Addendum.app.models.CONTRACT;
                  Contract.update(
                    { contractId: body.contractId },
                    { cancelDate: body.createdOnDate },
                    (contractErr) => {
                      if (contractErr){ 
                        console.log('CONTRACT ERRORED - Addendum.createWithNextAddendumNumber - cancel contract update')
                        cb(contractErr, null);
                      }else cb(null, addendumData);
                    });
                } else cb(null, addendumData);
              });
          }
        });
      }
    });
  };

  Addendum.getByContractId = contractId =>
    Addendum.find({ where: { contractId } });

  Addendum.deleteByContractId = (contractId) => {
    if (contractId === undefined) {
      return Promise.reject({ message: 'Missing contractId' });
    }

    return Addendum.destroyAll({ contractId });
  };

  Addendum.removeByContractId = Addendum.deleteByContractId;

  Addendum.getByContractAndAddendum = (contractId, addendumNumber) => {
    const filter = { where: { and: [{ contractId, addendumNumber }] } };
    return Addendum.find(filter);
  };

  Addendum.updateAddendumWithEnvelope =
    (contractId, addendumNumber, envelopeId, envelopeStatus) => {
      const filter = { and: [{ contractId }, { addendumNumber }] };
      return Addendum.updateAll(filter, { envelopeId, envelopeStatus });
    };

  Addendum.findSessionByEnvelopId = (envelopeId) => {
    const sessions = Addendum.app.models.Sessions;
    return sessions.find({ where: { 'contract.envelopeId':  envelopeId } }) // eslint-disable-line key-spacing
      .then((sessionList) => {
        const saveSession = sessionList[0];
        if (_.isUndefined(saveSession)) return null;
        return saveSession;
      });
  };

  Addendum.createSpecDecline = (contractId) => {
    if (contractId === undefined) {
      return Promise.reject({ message: 'Missing contractId' });
    }

    return new Promise((resolve, reject) => {
      const final = (err, data) => {
        if (err) reject(err);
        else resolve(data);
      };
      const where = { contractId };
      const parallel = {};

      parallel.contactInfo = (done) => {
        const contactInfo = Addendum.app.models.CONTACTINFO;
        contactInfo.destroyAll(where, done);
      };
      parallel.contract = (done) => {
        const contract = Addendum.app.models.CONTRACT;
        contract.deleteByContractId(contractId, done);
      };
      parallel.contractHeader = (done) => {
        const contractHeader = Addendum.app.models.CONTRACTHEADER;
        contractHeader.destroyAll(where, done);
      };
      parallel.optionSelection = (done) => {
        const optionSelection = Addendum.app.models.OPTIONSELECTION;
        optionSelection.destroyAll(where, done);
      };
      parallel.preferenceSelection = (done) => {
        const preferenceSelection = Addendum.app.models.PREFERENCESELECTION;
        preferenceSelection.destroyAll(where, done);
      };

      parallel.addendum = done => Addendum.destroyAll(where, done);

      async.parallel(parallel, final);
    });
  };

  Addendum.addendumDecline = (saveSession, sessions) => {
    const contractId = saveSession.contract.contractId;
    console.log('addendumDecline STARTED')
    console.log(contractId)
    if (contractId === undefined) {
      return Promise.reject({ message: 'Missing contractId' });
    }

    return new Promise((resolve, reject) => {
      sessions.duplicateSession(saveSession, (dupError) => {
        console.log('duplicateSession RETURNED to addendumDecline')
        if (dupError) reject(dupError);
        else {
          // Rollback the Addendum data
          const final = (err, data) => {
            if (err) reject(err);
            else resolve(data);
          };

          const where = { contractId };
          const parallel = {};
          if (saveSession.contract.sellSpec) {
            where.addendumNumber = saveSession.contract.addendumNumber;
            parallel.contactInfo = (done) => {
              const contactInfo = Addendum.app.models.CONTACTINFO;
              contactInfo.destroyAll(where, done);
            };
          } else if (saveSession.contract.addendumType === 'STR') {
            parallel.contract = (done) => {
              const contract = Addendum.app.models.CONTRACT;
              contract.destroyAll({ contractId }, done);
            };
            parallel.contractHeader = (done) => {
              const contractHeader = Addendum.app.models.CONTRACTHEADER;
              contractHeader.destroyAll(where, done);
            };
            parallel.contactInfo = (done) => {
              const contactInfo = Addendum.app.models.CONTACTINFO;
              contactInfo.destroyAll(where, done);
            };
          } else {
            where.addendumNumber = saveSession.contract.addendumNumber;
          }

          // Basic set of clean up for STR and Spec homes
          parallel.addendum = done => Addendum.destroyAll(where, done);
          parallel.optionSelection = (done) => {
            const optionSelection = Addendum.app.models.OPTIONSELECTION;
            optionSelection.destroyAll(where, done);
          };
          parallel.preferenceSelection = (done) => {
            const preferenceSelection = Addendum.app.models.PREFERENCESELECTION;
            preferenceSelection.destroyAll(where, done);
          };

          async.parallel(parallel, final);
        }
      });
    });
  };

  Addendum.cancelDecline = session =>
    new Promise((resolve, reject) => {
      const final = (err, data) => {
        if (err) reject(err);
        else resolve(data);
      };
      if ('contractId' in session.contract && (_.isString(session.contract.contractId) || _.isNumber(session.contract.contractId))) {
        // const contactInfoArray = session.contract.contactInfo;
        const contractId = session.contract.contractId;

        const parallel = {
          removeCancelAddendum: (done) => {
            Addendum.destroyAll({ contractId, addendumType: 'CAN' }, done);
          },
          removeClearAddendum: (done) => {
            Addendum.destroyAll({ contractId, addendumType: 'CLR' }, done);
          },
        };

        async.parallel(parallel, final);
      } else reject({ message: 'Missing contractId' });
    });

  Addendum.restorePreviousContract = saveSession => new Promise((resolve, reject) => {
    if (!('previousContractData' in saveSession.contract)) {
      resolve({ message: 'done' });
      return;
    }
    const final = (err, data) => {
      if (err) reject(err);
      else resolve(data);
    };
    const parallel = {
      contactInfo: (done) => {
        const contactInfo = Addendum.app.models.CONTACTINFO;
        const ci = saveSession.contract.previousContractData.contactInfo;
        if (ci) contactInfo.create(ci, done);
        else done();
      },
      contract: (done) => {
        const contract = Addendum.app.models.CONTRACT;
        const con = saveSession.contract.previousContractData.contract;
        if (con) contract.create(con, done);
        else done();
      },
      addendum: (done) => {
        const addendum = saveSession.contract.previousContractData.addendum;
        if (addendum) Addendum.create(addendum, done);
        else done();
      },
      contractHeader: (done) => {
        const contractHeader = Addendum.app.models.CONTRACTHEADER;
        const ch = saveSession.contract.previousContractData.contractHeader;
        if (ch) contractHeader.create(ch, done);
        else done();
      },
      optionSelection: (done) => {
        const optionSelection = Addendum.app.models.OPTIONSELECTION;
        const os = saveSession.contract.previousContractData.optionSelection;
        if (os) optionSelection.create(os, done);
        else done();
      },
    };
    async.parallel(parallel, final);
  });

  Addendum.resetContract = (saveSession) => {
    const contract = Addendum.app.models.CONTRACT;
    const filter = { contractId: saveSession.contract.contractId };
    const updateData = {
      promoNotes: '',
      discretionaryNotes: '',
      decoAllowance: 0,
      upgradeAmount: 0,
      sellerPaidClosingCosts: 0,
      realtorContribution: 0,
      commissionReduction: 0,
      rollInClosingCosts: 0,
      incentiveAmount2: 0,
      sourceOfSale: '',
      prequalified: 0,
    };
    return contract.updateAll(filter, updateData);
  };

  Addendum.getTotals = contractId => Addendum.find({
    where: {
      contractId,
      envelopeStatus: { inq: ['Completed', 'Pushed'] },
    },
  })
    .then(addendums => _.map(addendums, addendum => ({
      addendumType: addendum.addendumType,
      total: addendum.totalAmount,
    })));

  Addendum.cleanUpData = (envelopeStatus, session) => {
    console.log('cleanUpData STARTED')
    const responseSession = session;
    const saveSession = session;
    const sessions = Addendum.app.models.Sessions;
    if (/Declined/gi.test(envelopeStatus) || /Voided/gi.test(envelopeStatus)) {
      if (saveSession.contract.transfer) {
        // Delete current transfer contract
        // Recreate original contract
        console.log('saveSession was a transfer');
        return Addendum.addendumDecline(saveSession, sessions)
          .then(Addendum.restorePreviousContract.bind(null, saveSession));
      } else if (_.includes(['STR', 'LV', 'DECO', 'COD', 'COL'], saveSession.contract.addendumType) && !saveSession.contract.createSpec) {
        if (saveSession.contract.sellSpec) {
          console.log('saveSession was a sell spec');
          // Reset contract values for spec
          return Addendum.resetContract(saveSession)
            .then(Addendum.addendumDecline.bind(null, saveSession, sessions));
        } else {
          console.log("saveSession was not a Sell spec, or COS, CAN or CLR")
          return Addendum.addendumDecline(saveSession, sessions);
        }
      } else if (_.includes(['COS'], saveSession.contract.addendumType)) {
        console.log('Change Order clean up data');
        return Addendum.addendumDecline(saveSession, sessions)
          .then(sessions.removeChangeOptions.bind(null, saveSession));
      } else if (_.includes(['CAN', 'CLR'], saveSession.contract.addendumType)) {
        console.log('Cancel or Clear clean up data');
        return Addendum.cancelDecline(saveSession)
          .then(sessions.removeCancelState.bind(
            null,
            saveSession.contract.contractId,
            saveSession.contract.contactInfo
          ));
      }
      return Promise.resolve({ message: 'Invalid session decline. Check API.' });
    } else if (_.includes(['COS'], saveSession.contract.addendumType) && /Completed/gi.test(envelopeStatus)) { //this is probably the area causing option quantity issues
      // Add options to other contract
      sessions.addOptionsToContract(saveSession.contract.contractId, {
        changeOptions: saveSession.contract.options,
        changeOptionsTotal: saveSession.contract.optionSelectionTotal,
      }, (err) => {
        if (err) return Promise.resolve(err);
        return Promise.resolve(responseSession);
      });
    }
    return Promise.resolve(responseSession);
  };

  Addendum.updateDocusign = (filter, updates) => Addendum.updateAll(filter, updates);


  Addendum.updateSessionStateSignersDate = (envelopeStatus,signerStatus, session) => {
    console.log('update Session State and Signers: ');
    const sessions = Addendum.app.models.Sessions;
    const newState = envelopeStatus.trim();
    let message = `updateSessionStateSignersDate() | State ${newState}: `;

    if(signerStatus!=undefined){
      session.signerStatus = signerStatus;
    }
    if (session && session.states) {
      const currentState = session.states[session.states.length - 1].state.trim();
      if ('addendumType' in session.contract) {
        if (currentState !== 'Canceled') {
          if (newState === 'Pushed') {
            if (currentState === 'Completed') {
              session.states.push({ state: newState, dateTime: new Date() });
              message += `Added to: ${session.id}`;
              if('timezoneOffset' in session.contract){
                session.dateTime = moment().utcOffset(session.contract.timezoneOffset).format();
              }
            } else {
              message += `Skipped over: ${session.id} because status was ${currentState}, not Completed`;
            }
          } else {
            session.states.push({ state: newState, dateTime: new Date() });
            message += `Added to: ${session.id}`;
          }
        }
      }
    }
    console.log('session after changes:')
    return sessions.replaceOrCreate(session);
  };


  Addendum.updateSessionSpecDeclinedVoid = (envelope, session) => {
    //only triggered if session is a Spec, and an envelopeStatus of 'Declined' or 'Void'
    console.log('updateSessionSpecDeclineVoid Triggered');
    if(envelope!=undefined && session!=undefined){
      const sessions = Addendum.app.models.Sessions;
      session.signerStatus = envelope.signerStatus;
      session.states.push({ state: envelope.EnvelopeStatus.Status.trim(), dateTime: new Date() });
      if('timezoneOffset' in session.contract){
        session.dateTime = moment().utcOffset(session.contract.timezoneOffset).format();
      }
      return sessions.replaceOrCreate(session);
    

    }else{
      return session;
    }




  };

  Addendum.removeContactInfoOnCancel = (envelopeStatus, session) => {
    console.log('removeContactInfoOnCancel()')
    if ('contractId' in session.contract && (session.contract.addendumType === 'CAN' || session.contract.addendumType === 'CLR') && envelopeStatus.toLowerCase() === 'completed') {
      const contactInfo = Addendum.app.models.CONTACTINFO;
      const where = { contractId: session.contract.contractId };
      return contactInfo.destroyAll(where).then(() => session);
    }
    return Promise.resolve(session);
  };

  Addendum.addCanceledState = (envelopeStatus, chain) => //adding cancelled state to effected contract
    new Promise((resolve, reject) => {
      const sessions = Addendum.app.models.Sessions;
      if ((chain.session.contract.addendumType === 'CAN' || chain.session.contract.addendumType === 'CLR') && envelopeStatus.toLowerCase() === 'completed') {
        sessions.updateState('contractId',chain.session.contract.contractId,'Canceled',(results) => {
          resolve(chain);
        });
      } else {
        resolve(chain);
      }
    });



  // Need to change sales or cancel date
  Addendum.updateContractCreatedDate = (envelopeStatus, session) => {
    let chain = {};
    chain.session = session;
    console.log('chain')
    if (/Completed/gi.test(envelopeStatus)
        && 'contract' in chain.session
        && 'timezoneOffset' in chain.session.contract) {
      let updates = {};
      const contract = Addendum.app.models.CONTRACT;
      if (chain.session.contract.addendumType === 'CAN' || chain.session.contract.addendumType === 'CLR') {
        const cancelDate = moment()
              .utcOffset(chain.session.contract.timezoneOffset).format('YYYY-MM-DD');
        updates = { cancelDate };
      } else {
        const salesDate = moment()
              .utcOffset(chain.session.contract.timezoneOffset).format('YYYY-MM-DD');
        const transferInDate = moment()
              .utcOffset(chain.session.contract.timezoneOffset).format('YYYY-MM-DD');
        updates = { salesDate, transferInDate };
      }
      return contract.updateAll({
          contractId: chain.session.contract.contractId,
        }, updates)
        .then(con => _.merge(chain, { contract: con }));
    }
    return Promise.resolve(chain);
  };

  Addendum.addLotCancelRecord = (envelopeStatus, chain) => {
    const lot = Addendum.app.models.LOT;
    const lotCancel = Addendum.app.models.LOTCANCEL;
    const contract = Addendum.app.models.CONTRACT;
    const addendumType = chain.session.contract.addendumType;
    const contractId = chain.session.contract.contractId;
    console.log('addLotCancelRecord for addendum type: '+addendumType);
    if (
        /Completed/gi.test(envelopeStatus) &&
        _.includes(['CAN', 'CLR', 'TRN'], addendumType)
    ) {
      return lot.findOne({
        where: {
          lotId: chain.session.contract.lotId,
          communityId: chain.session.contract.communityId },
      }).then((results) => {
        const constructionStartDate = moment(results.constructionStartDate);
        if (
          constructionStartDate.isAfter(moment().format('YYYY-MM-DD'))
            || constructionStartDate.isBefore('1900-01-01')
        ) {
          const lotCanRecord = {
            lotId: results.lotId.trim(),
            communityId: results.communityId.trim(),
          };
          const success = () => {
            chain.lotCancel = 'key';
            return chain;
          };

          const vcap = JSON.parse(process.env.VCAP_SERVICES);
          const data = _.find(vcap['user-provided'], x => /ui-proxy/gi.test(x.name)).credentials.data;
          const username = data.auth.split(':')[0];
          const password = data.auth.split(':')[1];

          // Push contract to JDE
          // Create lot cancel record
          // remove the contract from dash
          return rp.get(`${data.target}/api/addendum/toE1/new/${contractId}`)
            .auth(username, password)
            .then(() => lotCancel.create(lotCanRecord))
            .then(contract.removeFullContract.bind(null, contractId))
            .then(success)
            .catch(success);
        }
        return chain;
      });
    }
    return Promise.resolve(chain);
  };

  Addendum.docusignPostback = (body, cb) => {
    if ('DocuSignEnvelopeInformation' in body) {
      if ('EnvelopeStatus' in body.DocuSignEnvelopeInformation) {
        const envelope = body.DocuSignEnvelopeInformation;
        const signerStatus = body.DocuSignEnvelopeInformation.signerStatus;
        const envelopeStatus = body.DocuSignEnvelopeInformation.EnvelopeStatus.Status;
        const envelopeId = body.DocuSignEnvelopeInformation.EnvelopeStatus.EnvelopeID;
        const filter = { envelopeId };
        const update = { envelopeStatus };
        console.log('Postback');
        // Add spec cancel flow since it doesn't use previous sessions.  Addendum.updateSessionState = (envelopeId, envelopeStatus, session)
        Addendum.updateAll(filter, update)
          .then(() => Addendum.findOne({ where: filter }))
          .then((foundAddendum) => {
            if (foundAddendum && _.isString(foundAddendum.addendumType)){
              const addendumType = foundAddendum.addendumType.trim();
              if (addendumType === 'SPC' && (/Declined/gi.test(envelopeStatus) || /Voided/gi.test(envelopeStatus))) {
                console.log('Specs that have been declined or voided')
                return Addendum.findSessionByEnvelopId(envelopeId)
                  .then(Addendum.updateSessionSpecDeclinedVoid.bind(null, envelope)) //new compact update session/state
                  .then(() => Addendum.createSpecDecline(foundAddendum.contractId))
                  .then(Addendum.cleanUpData.bind(null, envelopeStatus))
                  .then(() => cb(null, body))
                  .catch(err => cb(err));
              } else if (addendumType === 'SPC') {
                console.log('Specs that have not been declined or voided')
                if(envelopeStatus.toLowerCase() === 'completed'){
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(Addendum.updateContractCreatedDate.bind(null, envelopeStatus))
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                } else{
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                }  
              }else if (addendumType === 'CAN' || addendumType === 'CLR'){
                console.log('CAN/CLR addendum')
                if(envelopeStatus.toLowerCase() === 'completed'){
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(Addendum.removeContactInfoOnCancel.bind(null, envelopeStatus))
                    .then(Addendum.updateContractCreatedDate.bind(null, envelopeStatus))
                    .then(Addendum.addCanceledState.bind(null, envelopeStatus))
                    .then(Addendum.addLotCancelRecord.bind(null, envelopeStatus))
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                } else if(envelopeStatus.toLowerCase() === 'declined' || envelopeStatus.toLowerCase() === 'voided'){
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(Addendum.cleanUpData.bind(null, envelopeStatus))
                    .then(() => cb(null, body))
                    .catch(err => cb(err));   
                } else{
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                }
              }else if (addendumType === 'TRN'){
                console.log('TRN addendum')
                if(envelopeStatus.toLowerCase() === 'completed'){
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(Addendum.updateContractCreatedDate.bind(null, envelopeStatus))
                    .then(Addendum.addLotCancelRecord.bind(null, envelopeStatus))
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                } else if(envelopeStatus.toLowerCase() === 'declined' || envelopeStatus.toLowerCase() === 'voided'){
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(Addendum.cleanUpData.bind(null, envelopeStatus))
                    .then(() => cb(null, body))
                    .catch(err => cb(err));   
                } else{
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                  }
              }else if (addendumType === 'STR' ){
                console.log('STR addendum')
                if(envelopeStatus.toLowerCase() === 'completed'){
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(Addendum.updateContractCreatedDate.bind(null, envelopeStatus))
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                } else if(envelopeStatus.toLowerCase() === 'declined' || envelopeStatus.toLowerCase() === 'voided'){
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(Addendum.cleanUpData.bind(null, envelopeStatus))
                    .then(() => cb(null, body))
                    .catch(err => cb(err));   
                } else{
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                }                
              }else if (addendumType === 'LV' ){
                //new block for STR specific Completed
                if(envelopeStatus.toLowerCase() === 'completed'){
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                } else if(envelopeStatus.toLowerCase() === 'declined' || envelopeStatus.toLowerCase() === 'voided'){
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(Addendum.cleanUpData.bind(null, envelopeStatus))
                    .then(() => cb(null, body))
                    .catch(err => cb(err));   
                } else{
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                }                
              }else if (addendumType === 'DECO' ){
                //new block for STR specific Completed
                if(envelopeStatus.toLowerCase() === 'completed'){
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                } else if(envelopeStatus.toLowerCase() === 'declined' || envelopeStatus.toLowerCase() === 'voided'){
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(Addendum.cleanUpData.bind(null, envelopeStatus))
                    .then(() => cb(null, body))
                    .catch(err => cb(err));   
                } else{
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                }                
              }else if (addendumType === 'COD' ){
                //new block for STR specific Completed
                if(envelopeStatus.toLowerCase() === 'completed'){
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                } else if(envelopeStatus.toLowerCase() === 'declined' || envelopeStatus.toLowerCase() === 'voided'){
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(Addendum.cleanUpData.bind(null, envelopeStatus))
                    .then(() => cb(null, body))
                    .catch(err => cb(err));   
                } else{
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                }                
              }else if (addendumType === 'COL' ){
                //new block for STR specific Completed
                if(envelopeStatus.toLowerCase() === 'completed'){
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                } else if(envelopeStatus.toLowerCase() === 'declined' || envelopeStatus.toLowerCase() === 'voided'){
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(Addendum.cleanUpData.bind(null, envelopeStatus))
                    .then(() => cb(null, body))
                    .catch(err => cb(err));   
                } else{
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                }                
              }else if (addendumType === 'COS' ){
                //new block for STR specific Completed
                if(envelopeStatus.toLowerCase() === 'completed'){
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus))
                    .then(Addendum.cleanUpData.bind(null, envelopeStatus)) 
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                } else if(envelopeStatus.toLowerCase() === 'declined' || envelopeStatus.toLowerCase() === 'voided'){
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(Addendum.cleanUpData.bind(null, envelopeStatus))
                    .then(() => cb(null, body))
                    .catch(err => cb(err));   
                } else{
                    return Addendum.findSessionByEnvelopId(envelopeId)
                    .then(Addendum.updateSessionStateSignersDate.bind(null, envelopeStatus, signerStatus)) 
                    .then(() => cb(null, body))
                    .catch(err => cb(err));                  
                }                
              }else{
                    console.warn('POSTBACK SCENARIO NOT ACCOUNTED FOR!!! PLEASE REVIEW')
                    console.warn('envelope:');
                    console.warn(envelope);
                    console.warn('signerStatus:');
                    console.warn(signerStatus);
                    console.warn('envelopeStatus:');
                    console.warn(envelopeStatus);
                    console.warn('envelopeId:');
                    console.warn(envelopeId);
                    //not currently used. although if anything isnt caught by the returns it passes down to the final return statement
              }
            }else{
              console.error('ADDENDUM NOT FOUND FOR THIS ENVELOPE ID');
              console.error(envelope);
            }
          }).catch(e => cb({ e, statusCode: 500, name: 'Missing Addendum', body, status: 500 }, null));
      } else cb({ statusCode: 500, name: 'Missing EnvelopeStatus', body, status: 500 }, null);
    } else cb({ statusCode: 500, name: 'Missing DocuSignEnvelopeInformation', body, status: 500 }, null);
  };
};
