util = require 'util'
Backbone = require 'backbone'
_ = require 'underscore'
Queue = require '../queue'

Utils = require '../utils'

# @private
module.exports = class ModelCache
  constructor: ->
    @enabled = false
    @caches = {}
    @options = {modelTypes: {}}
    @verbose = false
    # @verbose = true

  # Configure the cache singleton
  #
  # options:
  #   max: default maximum number of items or max size of the cache
  #   max_age/maxAge: default maximum number of items or max size of the cache
  #   model_types/modelTypes: {'ModelName': options}
  #
  configure: (options) ->
    @enabled = options.enabled
    @reset()
    (@options = {modelTypes: {}}; return @) unless options # clear all options

    for key, value of options
      key = @normalizeKey(key)
      if _.isObject(value)
        @options[key] or= {}
        values = @options[key]
        values[@normalizeKey(value_key)] = value_value for value_key, value_value of value
      else
        @options[key] = value
    return @

  configureSync: (model_type, sync_fn) ->
    return sync_fn if model_type::_orm_never_cache or not (cache = @getOrCreateModelCache(model_type.model_name))
    model_type.cache = cache
    return require('./cache_sync')(model_type, sync_fn)

  reset: (callback) ->
    queue = new Queue()
    for key, value of @caches
      do (value) -> queue.defer (callback) value.reset(callback)
    queue.await callback

  hardReset: ->
    @configure()
    delete @caches[key] for key, value of @caches
    return @

  getOrCreateModelCache: (model_name) ->
    throw new Error "Missing model name for cache" unless model_name
    return model_cache if model_cache = @caches[model_name]

    # there are options
    if options = @options.modelTypes[model_name]
      return @caches[model_name] = new ModelCache(options)

    # there are global options
    else if @options.max or @options.maxAge
      return @caches[model_name] = new ModelCache(_.pick(@options, 'max', 'maxAge', 'length', 'dispose', 'stale'))

    return null
