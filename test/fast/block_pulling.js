"use strict";
var should = require('should');
var _ = require('underscore');
var co = require('co');
var Q = require('q');
var pulling = require('../../app/lib/pulling');
var constants = require("../../app/lib/constants.js");

let commonConf = {
  avgGenTime: constants.BRANCHES.SWITCH_ON_BRANCH_AHEAD_BY_X_MINUTES * 60,
  forksize: 100
};

describe('Pulling blocks', () => {

  it('from genesis with good sidechain should work', pullinTest({
    blockchain: [
      newBlock(0, 'A')
    ],
    sidechains: [
      [
        newBlock(0, 'A'),
        newBlock(1, 'A')  // <-- 1) checks this block: is good, we add it
      ]
    ],
    expectHash: 'A1'
  }));

  it('from genesis with fork sidechain should not work', pullinTest({
    blockchain: [
      newBlock(0, 'A')
    ],
    sidechains: [
      [
        newBlock(0, 'B'), // <-- 2) oh no this not common with blockchain A, leave this blockchain B alone
        newBlock(1, 'B')  // <-- 1) checks this block: ah, a fork! let's find common root ...
      ]
    ],
    expectHash: 'A0'
  }));

  it('from genesis with multiple good sidechains should work', pullinTest({
    blockchain: [
      newBlock(0, 'A')
    ],
    sidechains: [
      [
        newBlock(0, 'A'),
        newBlock(1, 'A'), // <-- 1) checks this block: is good, we add it
        newBlock(2, 'A')  // <-- 2) checks this block: is good, we add it
      ],
      [
        newBlock(0, 'A'),
        newBlock(1, 'A')  // <-- 3) you are a bit late ... we are on A2 yet!
      ],
      [
        newBlock(0, 'A'),
        newBlock(1, 'A'),
        newBlock(2, 'A'),
        newBlock(3, 'A')  // <-- 4) checks this block: is good, we add it
      ],
      [
        newBlock(0, 'A'),
        newBlock(1, 'A')  // <-- 5 really too late
      ]
    ],
    expectHash: 'A3'
  }));

  it('sync with a single fork', pullinTest({
    blockchain: [
      newBlock(0, 'A'),
      newBlock(1, 'A'),
      newBlock(2, 'A'),
      newBlock(3, 'A')
    ],
    sidechains: [
      [
        newBlock(0, 'A'), // <-- 2) sees a common root, yet not *the* common root (A1 is not a fork block)
        newBlock(1, 'A'), // <-- 4) yep this is the good one! sync from B2 to B5
        newBlock(2, 'B'), // <-- 3) check the middle, not the common root
        newBlock(3, 'B'),
        newBlock(4, 'B'), // <-- 1) checks this block: a fork, let's find common root
        newBlock(5, 'B')
      ]
    ],
    expectHash: 'B5'
  }));

  it('sync with multiple forks', pullinTest({
    blockchain: [
      newBlock(0, 'A'),
      newBlock(1, 'A'),
      newBlock(2, 'A'),
      newBlock(3, 'A')
    ],
    sidechains: [
      [
        newBlock(0, 'A'), // <-- 2) sees a common root, yet not *the* common root (A1 is not a fork block)
        newBlock(1, 'A'), // <-- 4) yep this is the good one! sync from B2 to B5
        newBlock(2, 'B'), // <-- 3) check the middle, not the common root
        newBlock(3, 'B'),
        newBlock(4, 'B'), // <-- 1) checks this block: a fork, let's find common root
        newBlock(5, 'B')
      ],
      // This fork should not be followed because we switch only one time per pulling, and B5 is already OK
      [
        newBlock(0, 'A'),
        newBlock(1, 'A'),
        newBlock(2, 'B'),
        newBlock(3, 'B'),
        newBlock(4, 'B'),
        newBlock(5, 'B'),
        newBlock(6, 'B')
      ]
    ],
    expectHash: 'B5'
  }));

  it('sync with inconsistant fork should skip it', pullinTest({
    blockchain: [
      newBlock(0, 'A'),
      newBlock(1, 'A'),
      newBlock(2, 'A'),
      newBlock(3, 'A')
    ],
    sidechains: [
      [
        newBlock(0, 'A'), // <-- 2) sees a common root, yet not *the* common root (A1 is not a fork block)
        qwaBlock(1, 'A'), // <-- 4) checks the middle: the block has changed and now displays C! this is inconsistent
        newBlock(2, 'C'), // <-- 3) checks the middle (binary search): too high, go downwards
        newBlock(3, 'C'),
        newBlock(4, 'C'), // <-- 1) sees a fork, try to find common root
        newBlock(5, 'C')
      ]
    ],
    expectHash: 'A3'
  }));
});

function newBlock(number, branch, rootBranch, quantum) {
  let previousNumber = number - 1;
  let previousBranch = rootBranch || branch;
  let previousHash = previousNumber >= 0 ? previousBranch + previousNumber : '';
  return {
    number: number,
    medianTime: number * constants.BRANCHES.SWITCH_ON_BRANCH_AHEAD_BY_X_MINUTES * 60,
    hash: branch + number,
    previousHash: previousHash,
    // this is not a real field, just here for the sake of demonstration: a quantum block changes itself
    // when we consult it, making the chain inconsistent
    quantum: quantum
  };
}

function qwaBlock(number, branch, rootBranch) {
  return newBlock(number, branch, rootBranch, true);
}

function pullinTest(testConfiguration) {
  return () => co(function *() {

    // The blockchains we are testing against
    let blockchain = testConfiguration.blockchain;
    let sidechains = testConfiguration.sidechains;

    // The data access object simulating network access
    let dao = mockDao(blockchain, sidechains);

    // The very last block of a blockchain should have the good number
    (yield dao.localCurrent()).should.have.property('number').equal(blockchain[blockchain.length - 1].number);

    // And after we make a pulling...
    yield pulling(commonConf, dao);

    // We test the new local blockchain current block (it should have changed in case of successful pull)
    let localCurrent = yield dao.localCurrent();
    if (testConfiguration.expectHash !== undefined && testConfiguration.expectHash !== null) {
      localCurrent.should.have.property('hash').equal(testConfiguration.expectHash);
    }
    if (testConfiguration.expectFunc !== undefined && testConfiguration.expectFunc !== null) {
      testConfiguration.expectFunc(dao);
    }
  });
}

/**
 * Network mocker
 * @param blockchain
 * @param sideChains
 * @returns {{localCurrent: (function(): (*|Q.Promise<*>|Q.Promise<T>)), remoteCurrent: (function(): (*|Q.Promise<*>|Q.Promise<T>)), remotePeers: (function(): (*|Q.Promise<*>|Q.Promise<T>)), getRemoteBlock: (function(): (*|Q.Promise<*|null>|Q.Promise<T>)), applyMainBranch: (function(): (*|Q.Promise<Number|*|_Chain<*>>|Q.Promise<T>)), removeForks: (function(): (*|Q.Promise<T>)), isMemberPeer: (function(): (*|Q.Promise<boolean>|Q.Promise<T>)), findCommonRoot: (function(): (*|Promise)), downloadBlocks: (function(): (*|Q.Promise<Buffer|ArrayBuffer|Array.<any>|string|*|_Chain<any>>|Q.Promise<T>)), applyBranch: (function())}}
 */
function mockDao(blockchain, sideChains) {
  let dao = {

    // Get the local blockchain current block
    localCurrent: () => Q(blockchain[blockchain.length - 1]),

    // Get the remote blockchain (bc) current block
    remoteCurrent: (bc) => Q(bc[bc.length - 1]),

    // Get the remote peers to be pulled
    remotePeers: () => Q(sideChains.map((sc, index) => {
      sc.pubkey = 'PUBK' + index;
      return sc;
    })),

    // Get block of given peer with given block number
    getLocalBlock: (number) => Q(blockchain[number] || null),

    // Get block of given peer with given block number
    getRemoteBlock: (bc, number) => co(function *() {
      let block = bc[number] || null;
      // Quantum block implementation
      if (block && block.quantum) {
        bc[number] = _.clone(block);
        bc[number].hash = 'Q' + block.hash;
      }
      return block;
    }),

    // Simulate the adding of a single new block on local blockchain
    applyMainBranch: (block) => Q(blockchain.push(block)),

    // Clean the eventual fork blocks already registered in DB (since real fork mechanism uses them, so we want
    // every old fork block to be removed)
    removeForks: () => Q(),

    // Tells wether given peer is a member peer
    isMemberPeer: (peer) => Q(true),

    // Simulates the downloading of blocks from a peer
    downloadBlocks: (bc, fromNumber, count) => Q(bc.slice(fromNumber, fromNumber + count)),

    // Simulate the adding of new blocks on local blockchain
    applyBranch: (blocks) => {
      blockchain = blockchain.concat(blocks);
      return Q(true);
    }
  };

  dao.findCommonRoot = (fork, forksize) => co(function *() {

    let commonRoot = null;
    let localCurrent = yield dao.localCurrent();

    // We look between the top block that is known as fork ...
    let topBlock = fork.block;
    // ... and the bottom which is bounded by `forksize`
    let bottomBlock = yield dao.getRemoteBlock(fork.peer, Math.max(0, localCurrent.number - forksize));
    let lookBlock = bottomBlock;
    let localEquivalent = yield dao.getLocalBlock(bottomBlock.number);
    let isCommonBlock = lookBlock.hash == localEquivalent.hash;
    if (isCommonBlock) {

      // Then common root can be found between top and bottom. We process.
      let position, wrongRemotechain = false;
      do {

        isCommonBlock = lookBlock.hash == localEquivalent.hash;
        if (!isCommonBlock) {

          // Too high, look downward
          topBlock = lookBlock;
          position = middle(topBlock.number, bottomBlock.number);
        }
        else {
          let upperBlock = yield dao.getRemoteBlock(fork.peer, lookBlock.number + 1);
          let localUpper = yield dao.getLocalBlock(upperBlock.number);
          let isCommonUpper = upperBlock.hash == localUpper.hash;
          if (isCommonUpper) {

            // Too low, look upward
            bottomBlock = lookBlock;
            position = middle(topBlock.number, bottomBlock.number);
          }
          else {

            // Spotted!
            commonRoot = lookBlock;
          }
        }

        let noSpace = topBlock.number == bottomBlock.number + 1;
        if (!commonRoot && noSpace) {
          // Remote node have inconsistency blockchain, stop search
          wrongRemotechain = true;
        }

        if (!wrongRemotechain) {
          lookBlock = yield dao.getRemoteBlock(fork.peer, position);
          localEquivalent = yield dao.getLocalBlock(position);
        }
      } while (!commonRoot && !wrongRemotechain);
    }
    // Otherwise common root is unreachable


    return Q(commonRoot);
  });

  return dao;
}

function middle(top, bottom) {
  let difference = top - bottom;
  if (difference % 2 == 1) {
    // We look one step below to not forget any block
    difference++;
  }
  return bottom + (difference / 2);
}