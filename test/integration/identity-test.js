"use strict";

var _         = require('underscore');
var co        = require('co');
var should    = require('should');
var ucoin     = require('./../../index');
var bma       = require('./../../app/lib/streams/bma');
var user      = require('./tools/user');
var constants = require('../../app/lib/constants');
var rp        = require('request-promise');
var httpTest  = require('./tools/http');
var commit    = require('./tools/commit');

var expectAnswer   = httpTest.expectAnswer;

var MEMORY_MODE = true;
var commonConf = {
  ipv4: '127.0.0.1',
  currency: 'bb',
  httpLogs: true,
  forksize: 3,
  sigWoT: 2,
  msValidity: 10000,
  parcatipate: false, // TODO: to remove when startGeneration will be an explicit call
  sigQty: 1
};

var s1 = ucoin({
  memory: MEMORY_MODE,
  name: 'bb11'
}, _.extend({
  port: '7799',
  pair: {
    pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd',
    sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP'
  }
}, commonConf));

var cat = user('cat', { pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd', sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP'}, { server: s1 });
var tac = user('tac', { pub: '2LvDg21dVXvetTD9GdkPLURavLYEqP3whauvPWX4c2qc', sec: '2HuRLWgKgED1bVio1tdpeXrf7zuUszv1yPHDsDj7kcMC4rVSN9RC58ogjtKNfTbH1eFz7rn38U1PywNs3m6Q7UxE'}, { server: s1 });
var toc = user('toc', { pub: 'DKpQPUL4ckzXYdnDRvCRKAm1gNvSdmAXnTrJZ7LvM5Qo', sec: '64EYRvdPpTfLGGmaX5nijLXRqWXaVz8r1Z1GtaahXwVSJGQRn7tqkxLb288zwSYzELMEG5ZhXSBYSxsTsz1m9y8F'}, { server: s1 });
var tic = user('tic', { pub: 'DNann1Lh55eZMEDXeYt59bzHbA3NJR46DeQYCS2qQdLV', sec: '468Q1XtTq7h84NorZdWBZFJrGkB18CbmbHr9tkp9snt5GiERP7ySs3wM8myLccbAAGejgMRC9rqnXuW3iAfZACm7'}, { server: s1 });
var tic2 = user('tic', { pub: '4KEA63RCFF7AXUePPg5Q7JX9RtzXjywai1iKmE7LcoEC', sec: '48vHGE2xkhnC81ChSu7dHaNv8JqnYubyyHRbkmkeAPKNg8Tv2BE7kVi3voh2ZhfVpQhEJLzceufzqpJ2dqnyXNSp'}, { server: s1 });
var man1 = user('man1', { pub: '12AbjvYY5hxV4v2KrN9pnGzgFxogwrzgYyncYHHsyFDK', sec: '2h8UNKE4YRnjmTGQTrgf4DZp2h3F5LqjnecxP8AgU6aH1x4dvbNVirsNeBiSR2UQfExuLAbdXiyM465hb5qUxYC1'}, { server: s1 });
var man2 = user('man2', { pub: 'E44RxG9jKZQsaPLFSw2ZTJgW7AVRqo1NGy6KGLbKgtNm', sec: 'pJRwpaCWshKZNWsbDxAHFQbVjk6X8gz9eBy9jaLnVY9gUZRqotrZLZPZe68ag4vEX1Y8mX77NhPXV2hj9F1UkX3'}, { server: s1 });
var man3 = user('man3', { pub: '5bfpAfZJ4xYspUBYseASJrofhRm6e6JMombt43HBaRzW', sec: '2VFQtEcYZRwjoc8Lxwfzcejtw9VP8VAi47WjwDDjCJCXu7g1tXUAbVZN3QmvG6NJqaSuLCuYP7WDHWkFmTrUEMaE'}, { server: s1 });

var now = Math.round(new Date().getTime() / 1000);

describe("Identities", function() {

  before(function() {

    var commitS1 = commit(s1);

    return co(function *() {
      yield s1.initWithServices().then(bma);
      yield cat.selfCertPromise(now);
      yield tac.selfCertPromise(now);
      yield toc.selfCertPromise(now);
      yield tic.selfCertPromise(now);
      yield toc.certPromise(cat);
      yield cat.certPromise(toc);
      yield cat.certPromise(tic);
      yield tic.certPromise(tac);
      yield cat.joinPromise();
      yield toc.joinPromise();
      yield tic.joinPromise();
      yield tac.joinPromise();
      yield commitS1();
      yield commitS1();

      // We have the following WoT (diameter 3):

      /**
       *  toc <=> cat -> tic -> tac
       */

      // cat is the sentry

      // Man1 is someone who just needs a commit to join
      yield man1.selfCertPromise(now);
      yield man1.joinPromise();
      yield tac.certPromise(man1);

      /**
       *  toc <=> cat -> tic -> tac -> man1
       */

      // Man2 is someone who has no certifications yet has sent a JOIN
      yield man2.selfCertPromise(now);
      yield man2.joinPromise();

      // Man3 is someone who has only published its identity
      yield man3.selfCertPromise(now);

      // tic RENEW, but not written
      yield tic.joinPromise(now);

      try {
        yield tic.selfCertPromise(now + 2);
        throw 'Should have thrown an error for already used pubkey';
      } catch (e) {
        JSON.parse(e).message.should.equal('Pubkey already used in the blockchain');
      }
      try {
        yield tic2.selfCertPromise(now);
        throw 'Should have thrown an error for already used uid';
      } catch (e) {
        JSON.parse(e).message.should.equal('UID already used in the blockchain');
      }
    });
  });

  it('should have 4 members', function() {
    return expectAnswer(rp('http://127.0.0.1:7799/wot/members', { json: true }), function(res) {
      res.should.have.property('results').length(4);
      _.pluck(res.results, 'uid').sort().should.deepEqual(['cat', 'tac', 'tic', 'toc']);
    });
  });

  it('should have identity-of/cat', function() {
    return expectAnswer(rp('http://127.0.0.1:7799/wot/identity-of/cat', { json: true }), function(res) {
      res.should.have.property('pubkey').equal('HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd');
      res.should.have.property('uid').equal('cat');
      res.should.have.property('sigDate').be.a.Number;
    });
  });

  it('should have identity-of/toc', function() {
    return expectAnswer(rp('http://127.0.0.1:7799/wot/identity-of/toc', { json: true }), function(res) {
      res.should.have.property('pubkey').equal('DKpQPUL4ckzXYdnDRvCRKAm1gNvSdmAXnTrJZ7LvM5Qo');
      res.should.have.property('uid').equal('toc');
      res.should.have.property('sigDate').be.a.Number;
    });
  });

  it('should have identity-of/tic', function() {
    return expectAnswer(rp('http://127.0.0.1:7799/wot/identity-of/tic', { json: true }), function(res) {
      res.should.have.property('pubkey').equal('DNann1Lh55eZMEDXeYt59bzHbA3NJR46DeQYCS2qQdLV');
      res.should.have.property('uid').equal('tic');
      res.should.have.property('sigDate').be.a.Number;
    });
  });

  it('should have identity-of/aaa', function() {
    return httpTest.expectError(404, "No member matching this pubkey or uid", rp('http://127.0.0.1:7799/wot/identity-of/aaa'));
  });

  it('should have certifiers-of/cat giving results', function() {
    return expectAnswer(rp('http://127.0.0.1:7799/wot/certifiers-of/cat', { json: true }), function(res) {
      res.should.have.property('pubkey').equal('HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd');
      res.should.have.property('uid').equal('cat');
      res.should.have.property('isMember').equal(true);
      res.should.have.property('sigDate').be.a.Number;
      res.should.have.property('certifications').length(1);
      let certs = res.certifications;
      certs[0].should.have.property('pubkey').equal('DKpQPUL4ckzXYdnDRvCRKAm1gNvSdmAXnTrJZ7LvM5Qo');
      certs[0].should.have.property('uid').equal('toc');
      certs[0].should.have.property('isMember').equal(true);
      certs[0].should.have.property('wasMember').equal(true);
      certs[0].should.have.property('sigDate').be.a.Number;
      certs[0].should.have.property('cert_time').property('block').be.a.Number;
      certs[0].should.have.property('cert_time').property('medianTime').be.a.Number;
      certs[0].should.have.property('written').property('number').equal(0);
      certs[0].should.have.property('written').property('hash').not.equal('');
      certs[0].should.have.property('signature').not.equal('');
    });
  });

  it('should have certifiers-of/tic giving results', function() {
    return expectAnswer(rp('http://127.0.0.1:7799/wot/certifiers-of/tic', { json: true }), function(res) {
      res.should.have.property('pubkey').equal('DNann1Lh55eZMEDXeYt59bzHbA3NJR46DeQYCS2qQdLV');
      res.should.have.property('uid').equal('tic');
      res.should.have.property('isMember').equal(true);
      res.should.have.property('sigDate').be.a.Number;
      res.should.have.property('certifications').length(1);
      let certs = res.certifications;
      certs[0].should.have.property('pubkey').equal('HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd');
      certs[0].should.have.property('uid').equal('cat');
      certs[0].should.have.property('isMember').equal(true);
      certs[0].should.have.property('wasMember').equal(true);
      certs[0].should.have.property('sigDate').be.a.Number;
      certs[0].should.have.property('cert_time').property('block').be.a.Number;
      certs[0].should.have.property('cert_time').property('medianTime').be.a.Number;
      certs[0].should.have.property('written').property('number').equal(0);
      certs[0].should.have.property('written').property('hash').not.equal('');
      certs[0].should.have.property('signature').not.equal('');
    });
  });

  it('should have certifiers-of/toc giving results', function() {
    return expectAnswer(rp('http://127.0.0.1:7799/wot/certifiers-of/toc', { json: true }), function(res) {
      res.should.have.property('pubkey').equal('DKpQPUL4ckzXYdnDRvCRKAm1gNvSdmAXnTrJZ7LvM5Qo');
      res.should.have.property('uid').equal('toc');
      res.should.have.property('isMember').equal(true);
      res.should.have.property('sigDate').be.a.Number;
      res.should.have.property('certifications').length(1);
      let certs = res.certifications;
      certs[0].should.have.property('pubkey').equal('HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd');
      certs[0].should.have.property('uid').equal('cat');
      certs[0].should.have.property('isMember').equal(true);
      certs[0].should.have.property('wasMember').equal(true);
      certs[0].should.have.property('sigDate').be.a.Number;
      certs[0].should.have.property('cert_time').property('block').be.a.Number;
      certs[0].should.have.property('cert_time').property('medianTime').be.a.Number;
      certs[0].should.have.property('written').property('number').equal(0);
      certs[0].should.have.property('written').property('hash').not.equal('');
      certs[0].should.have.property('signature').not.equal('');
    });
  });

  it('requirements of cat', function() {
    return expectAnswer(rp('http://127.0.0.1:7799/wot/requirements/cat', { json: true }), function(res) {
      res.should.have.property('identities').be.an.Array;
      res.should.have.property('identities').have.length(1);
      res.identities[0].should.have.property('pubkey').equal('HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd');
      res.identities[0].should.have.property('uid').equal('cat');
      res.identities[0].should.have.property('meta').property('timestamp');
      res.identities[0].should.have.property('outdistanced').equal(false);
      res.identities[0].should.have.property('certifications').have.length(1);
      res.identities[0].should.have.property('membershipPendingExpiresIn').equal(0);
      res.identities[0].should.have.property('membershipExpiresIn').greaterThan(9000);
    });
  });

  it('requirements of man1', function() {
    return expectAnswer(rp('http://127.0.0.1:7799/wot/requirements/man1', { json: true }), function(res) {
      res.should.have.property('identities').be.an.Array;
      res.should.have.property('identities').have.length(1);
      res.identities[0].should.have.property('pubkey').equal('12AbjvYY5hxV4v2KrN9pnGzgFxogwrzgYyncYHHsyFDK');
      res.identities[0].should.have.property('uid').equal('man1');
      res.identities[0].should.have.property('meta').property('timestamp');
      res.identities[0].should.have.property('outdistanced').equal(false);
      res.identities[0].should.have.property('certifications').length(1);
      res.identities[0].certifications[0].should.have.property('from').equal('2LvDg21dVXvetTD9GdkPLURavLYEqP3whauvPWX4c2qc');
      res.identities[0].certifications[0].should.have.property('to').equal('12AbjvYY5hxV4v2KrN9pnGzgFxogwrzgYyncYHHsyFDK');
      res.identities[0].certifications[0].should.have.property('expiresIn').greaterThan(0);
      res.identities[0].should.have.property('membershipPendingExpiresIn').greaterThan(9000);
      res.identities[0].should.have.property('membershipExpiresIn').equal(0);
    });
  });

  it('should have certified-by/tic giving results', function() {
    return expectAnswer(rp('http://127.0.0.1:7799/wot/certified-by/tic', { json: true }), function(res) {
      res.should.have.property('pubkey').equal('DNann1Lh55eZMEDXeYt59bzHbA3NJR46DeQYCS2qQdLV');
      res.should.have.property('uid').equal('tic');
      res.should.have.property('isMember').equal(true);
      res.should.have.property('sigDate').be.a.Number;
      res.should.have.property('certifications').length(1);
      let certs = res.certifications;
      certs[0].should.have.property('pubkey').equal('2LvDg21dVXvetTD9GdkPLURavLYEqP3whauvPWX4c2qc');
      certs[0].should.have.property('uid').equal('tac');
      certs[0].should.have.property('isMember').equal(true);
      certs[0].should.have.property('wasMember').equal(true);
      certs[0].should.have.property('sigDate').be.a.Number;
      certs[0].should.have.property('cert_time').property('block').be.a.Number;
      certs[0].should.have.property('cert_time').property('medianTime').be.a.Number;
      certs[0].should.have.property('written').property('number').equal(0);
      certs[0].should.have.property('written').property('hash').not.equal('');
      certs[0].should.have.property('signature').not.equal('');
    });
  });

  it('should have certified-by/tac giving results', function() {
    return expectAnswer(rp('http://127.0.0.1:7799/wot/certified-by/tac', { json: true }), function(res) {
      res.should.have.property('pubkey').equal('2LvDg21dVXvetTD9GdkPLURavLYEqP3whauvPWX4c2qc');
      res.should.have.property('uid').equal('tac');
      res.should.have.property('isMember').equal(true);
      res.should.have.property('sigDate').be.a.Number;
      res.should.have.property('certifications').length(0);
    });
  });

  it('should have certified-by/cat giving results', function() {
    return expectAnswer(rp('http://127.0.0.1:7799/wot/certified-by/cat', { json: true }), function(res) {
      res.should.have.property('pubkey').equal('HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd');
      res.should.have.property('uid').equal('cat');
      res.should.have.property('isMember').equal(true);
      res.should.have.property('sigDate').be.a.Number;
      res.should.have.property('certifications').length(2);
      let certs = res.certifications;
      certs[0].should.have.property('pubkey').equal('DKpQPUL4ckzXYdnDRvCRKAm1gNvSdmAXnTrJZ7LvM5Qo');
      certs[0].should.have.property('uid').equal('toc');
      certs[0].should.have.property('isMember').equal(true);
      certs[0].should.have.property('wasMember').equal(true);
      certs[0].should.have.property('sigDate').be.a.Number;
      certs[0].should.have.property('cert_time').property('block').be.a.Number;
      certs[0].should.have.property('cert_time').property('medianTime').be.a.Number;
      certs[0].should.have.property('written').property('number').equal(0);
      certs[0].should.have.property('written').property('hash').not.equal('');
      certs[0].should.have.property('signature').not.equal('');
      certs[1].should.have.property('pubkey').equal('DNann1Lh55eZMEDXeYt59bzHbA3NJR46DeQYCS2qQdLV');
      certs[1].should.have.property('uid').equal('tic');
      certs[1].should.have.property('isMember').equal(true);
      certs[1].should.have.property('wasMember').equal(true);
      certs[1].should.have.property('sigDate').be.a.Number;
      certs[1].should.have.property('cert_time').property('block').be.a.Number;
      certs[1].should.have.property('cert_time').property('medianTime').be.a.Number;
      certs[1].should.have.property('written').property('number').equal(0);
      certs[1].should.have.property('written').property('hash').not.equal('');
      certs[1].should.have.property('signature').not.equal('');
    });
  });

  it('requirements of man2', function() {
    return expectAnswer(rp('http://127.0.0.1:7799/wot/requirements/man2', { json: true }), function(res) {
      res.should.have.property('identities').be.an.Array;
      res.should.have.property('identities').have.length(1);
      res.identities[0].should.have.property('pubkey').equal('E44RxG9jKZQsaPLFSw2ZTJgW7AVRqo1NGy6KGLbKgtNm');
      res.identities[0].should.have.property('uid').equal('man2');
      res.identities[0].should.have.property('meta').property('timestamp');
      res.identities[0].should.have.property('outdistanced').equal(true);
      res.identities[0].should.have.property('certifications').length(0);
      res.identities[0].should.have.property('membershipPendingExpiresIn').greaterThan(9000);
      res.identities[0].should.have.property('membershipExpiresIn').equal(0);
    });
  });

  it('requirements of man3', function() {
    return expectAnswer(rp('http://127.0.0.1:7799/wot/requirements/man3', { json: true }), function(res) {
      res.should.have.property('identities').be.an.Array;
      res.should.have.property('identities').have.length(1);
      res.identities[0].should.have.property('pubkey').equal('5bfpAfZJ4xYspUBYseASJrofhRm6e6JMombt43HBaRzW');
      res.identities[0].should.have.property('uid').equal('man3');
      res.identities[0].should.have.property('meta').property('timestamp');
      res.identities[0].should.have.property('outdistanced').equal(true);
      res.identities[0].should.have.property('certifications').length(0);
      res.identities[0].should.have.property('membershipPendingExpiresIn').equal(0);
      res.identities[0].should.have.property('membershipExpiresIn').equal(0);
    });
  });

  it('memberships of tic', function() {
    return expectAnswer(rp('http://127.0.0.1:7799/blockchain/memberships/tic', { json: true }), function(res) {
      res.should.have.property('pubkey').equal('DNann1Lh55eZMEDXeYt59bzHbA3NJR46DeQYCS2qQdLV');
      res.should.have.property('uid').equal('tic');
      res.should.have.property('sigDate').be.a.Number;
      res.should.have.property('memberships').length(2);
      // Initial membership
      res.memberships[0].should.have.property('version').equal(1);
      res.memberships[0].should.have.property('currency').equal('bb');
      res.memberships[0].should.have.property('membership').equal('IN');
      res.memberships[0].should.have.property('blockNumber').equal(1);
      res.memberships[0].should.have.property('blockHash').not.equal('DA39A3EE5E6B4B0D3255BFEF95601890AFD80709');
      res.memberships[0].should.have.property('written').equal(null);
      // Renew membership, not written
      res.memberships[1].should.have.property('version').equal(1);
      res.memberships[1].should.have.property('currency').equal('bb');
      res.memberships[1].should.have.property('membership').equal('IN');
      res.memberships[1].should.have.property('blockNumber').equal(0);
      res.memberships[1].should.have.property('blockHash').equal('DA39A3EE5E6B4B0D3255BFEF95601890AFD80709');
      res.memberships[1].should.have.property('written').equal(0);
    });
  });

  it('memberships of man3', function() {
    return httpTest.expectHttpCode(404, rp('http://127.0.0.1:7799/blockchain/memberships/man3'));
  });

  it('difficulties', function() {
    return expectAnswer(rp('http://127.0.0.1:7799/blockchain/difficulties', { json: true }), function(res) {
      res.should.have.property('block').equal(1);
      res.should.have.property('levels').length(1);
      res.levels[0].should.have.property('uid').equal('cat');
      res.levels[0].should.have.property('level').equal(0);
    });
  });
});
