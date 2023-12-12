'use strict';

const {expect} = require('chai');
const config = require('../lib/index.js');

describe('xcraft.host.tribe', function () {
  it('compute tribe number from an id', function () {
    [
      {id: 'a', tribe: 0},
      {id: 'a@', tribe: 0},
    ].forEach(({id, tribe}) =>
      expect(config.getTribeFromId(id, 4)).to.be.equal(tribe)
    );

    [
      {id: 'a@0', tribe: 1}, // 48
      {id: 'a@1', tribe: 2}, // 49
      {id: 'a@2', tribe: 3}, // 50
      {id: 'a@3', tribe: 1}, // 51
      {id: 'a@4', tribe: 2}, // 52
    ].forEach(({id, tribe}) =>
      expect(config.getTribeFromId(id, 4)).to.be.equal(tribe)
    );

    [
      {id: 'a@a', tribe: 2}, //  97
      {id: 'a@b', tribe: 3}, //  98
      {id: 'a@c', tribe: 1}, //  99
      {id: 'a@d', tribe: 2}, // 100
      {id: 'a@e', tribe: 3}, // 101
    ].forEach(({id, tribe}) =>
      expect(config.getTribeFromId(id, 4)).to.be.equal(tribe)
    );

    [
      {id: 'a@z@0', tribe: 1}, // 48
      {id: 'a@z@1', tribe: 2}, // 49
      {id: 'a@z@2', tribe: 3}, // 50
      {id: 'a@z@3', tribe: 1}, // 51
      {id: 'a@z@4', tribe: 2}, // 52
    ].forEach(({id, tribe}) =>
      expect(config.getTribeFromId(id, 4)).to.be.equal(tribe)
    );

    [
      {id: 'a@z@a', tribe: 2}, //  97
      {id: 'a@z@b', tribe: 3}, //  98
      {id: 'a@z@c', tribe: 1}, //  99
      {id: 'a@z@d', tribe: 2}, // 100
      {id: 'a@z@e', tribe: 3}, // 101
    ].forEach(({id, tribe}) =>
      expect(config.getTribeFromId(id, 4)).to.be.equal(tribe)
    );

    [
      {id: 'a@z@01', tribe: 2}, // 48 + 49
      {id: 'a@z@12', tribe: 1}, // 49 + 50
      {id: 'a@z@23', tribe: 3}, // 50 + 51
      {id: 'a@z@34', tribe: 2}, // 51 + 52
      {id: 'a@z@40', tribe: 2}, // 52 + 48
    ].forEach(({id, tribe}) =>
      expect(config.getTribeFromId(id, 4)).to.be.equal(tribe)
    );

    [
      {id: 'a@z@ab', tribe: 1}, //  97 +  98
      {id: 'a@z@bc', tribe: 3}, //  98 +  99
      {id: 'a@z@cd', tribe: 2}, //  99 + 100
      {id: 'a@z@de', tribe: 1}, // 100 + 101
      {id: 'a@z@ea', tribe: 1}, // 101 +  97
    ].forEach(({id, tribe}) =>
      expect(config.getTribeFromId(id, 4)).to.be.equal(tribe)
    );

    [
      {id: 'a@z@01234', tribe: 1}, // 48 + 50 + 52
      {id: 'a@z@12340', tribe: 2}, // 49 + 51 + 48
      {id: 'a@z@23401', tribe: 2}, // 50 + 52 + 49
      {id: 'a@z@34012', tribe: 3}, // 51 + 48 + 50
      {id: 'a@z@40123', tribe: 3}, // 52 + 49 + 51
    ].forEach(({id, tribe}) =>
      expect(config.getTribeFromId(id, 4)).to.be.equal(tribe)
    );

    [
      {id: 'a@z@abcde', tribe: 1}, //  97 +  99 + 101
      {id: 'a@z@bcdea', tribe: 2}, //  98 + 100 +  97
      {id: 'a@z@cdeab', tribe: 2}, //  99 + 101 +  98
      {id: 'a@z@deabc', tribe: 3}, // 100 +  97 +  99
      {id: 'a@z@eabcd', tribe: 3}, // 101 +  98 + 100
    ].forEach(({id, tribe}) =>
      expect(config.getTribeFromId(id, 4)).to.be.equal(tribe)
    );
  });
});
