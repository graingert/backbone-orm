# TODO: explain required set up

# each model should be fabricated with 'id', 'name', 'created_at', 'updated_at'
# beforeEach should return the models_json for the current run
module.exports = (options) ->
  MODEL_TYPE = options.model_type
  BEFORE_EACH = options.beforeEach
  MODELS_JSON = null

  util = require 'util'
  assert = require 'assert'
  _ = require 'underscore'
  Queue = require 'queue-async'

  Utils = require '../../../utils'

  describe 'hasMany', ->

    beforeEach (done) ->
      BEFORE_EACH (err, models_json) ->
        return done(err) if err
        return done(new Error "Missing models json for initialization") unless models_json
        MODELS_JSON = models_json
        done()

    it 'Handles a get query for a hasMany relation', (done) ->
      MODEL_TYPE.find {$one: true}, (err, test_model) ->
        assert.ok(!err, "No errors: #{err}")
        assert.ok(test_model, 'found model')

        test_model.get 'flats', (err, flats) ->
          assert.ok(!err, "No errors: #{err}")
          assert.equal(2, flats.length, "Expected: #{2}. Actual: #{flats.length}")
          if test_model.relationIsEmbedded('flats')
            assert.deepEqual(test_model.toJSON().flats[0], flats[0].toJSON(), "Serialized embedded. Expected: #{test_model.toJSON().flats[0]}. Actual: #{flats[0].toJSON()}")
          done()

    it 'Handles an async get query for ids', (done) ->
      MODEL_TYPE.find {$one: true}, (err, test_model) ->
        assert.ok(!err, "No errors: #{err}")
        assert.ok(test_model, 'found model')

        test_model.get 'flat_ids', (err, ids) ->
          assert.ok(!err, "No errors: #{err}")
          assert.equal(2, ids.length, "Expected count: #{2}. Actual: #{ids.length}")
          done()

    it 'Handles a synchronous get query for ids after the relations are loaded', (done) ->
      MODEL_TYPE.find {$one: true}, (err, test_model) ->
        assert.ok(!err, "No errors: #{err}")
        assert.ok(test_model, 'found model')

        test_model.get 'flats', (err, flats) ->
          assert.ok(!err, "No errors: #{err}")
          assert.equal(test_model.get('flat_ids').length, flats.length, "Expected count: #{test_model.get('flat_ids').length}. Actual: #{flats.length}")
          assert.deepEqual(test_model.get('flat_ids')[0], flats[0].get('id'), "Serialized id only. Expected: #{test_model.get('flat_ids')[0]}. Actual: #{flats[0].get('id')}")
          done()

    it 'Handles a get query for a hasMany and belongsTo two sided relation', (done) ->
      MODEL_TYPE.find {$one: true}, (err, test_model) ->
        assert.ok(!err, "No errors: #{err}")
        assert.ok(test_model, 'found model')

        test_model.get 'reverses', (err, reverses) ->
          assert.ok(!err, "No errors: #{err}")
          assert.ok(reverses, 'found models')
          assert.equal(2, reverses.length, "Expected: #{2}. Actual: #{reverses.length}")

          if test_model.relationIsEmbedded('reverses')
            assert.deepEqual(test_model.toJSON().reverses[0], reverses[0].toJSON(), 'Serialized embedded')
          assert.deepEqual(test_model.get('reverse_ids')[0], reverses[0].get('id'), 'serialized id only')
          reverse = reverses[0]

          reverse.get 'owner', (err, owner) ->
            assert.ok(!err, "No errors: #{err}")
            assert.ok(owner, 'found owner models')
            if reverse.relationIsEmbedded('owner')
              assert.deepEqual(reverse.toJSON().owner_id, owner.get('id'), "Serialized embedded. Expected: #{util.inspect(reverse.toJSON().owner_id)}. Actual: #{util.inspect(owner.get('id'))}")
            assert.deepEqual(reverse.get('owner_id'), owner.get('id'), "Serialized id only. Expected: #{reverse.toJSON().owner}. Actual: #{owner.get('id')}")

            if MODEL_TYPE.cache()
              assert.deepEqual(JSON.stringify(test_model.toJSON()), JSON.stringify(owner.toJSON()), "\nExpected: #{util.inspect(test_model.toJSON())}\nActual: #{util.inspect(test_model.toJSON())}")
            else
              assert.equal(test_model.get('id'), owner.get('id'), "\nExpected: #{test_model.get('id')}\nActual: #{owner.get('id')}")
            done()
