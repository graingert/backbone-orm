/*
  backbone-orm.js 0.5.6
  Copyright (c) 2013 Vidigami - https://github.com/vidigami/backbone-orm
  License: MIT (http://www.opensource.org/licenses/mit-license.php)
  Dependencies: Backbone.js, Underscore.js, Moment.js, and Inflection.js.
*/

var JSONUtils, Queue, moment, _;

_ = require('underscore');

moment = require('moment');

Queue = require('./queue');

module.exports = JSONUtils = (function() {
  var _this = this;

  function JSONUtils() {}

  JSONUtils.parseParams = function(params) {
    var key, result, value;
    result = {};
    for (key in params) {
      value = params[key];
      result[key] = JSON.parse(value);
    }
    return result;
  };

  JSONUtils.parse = function(values) {
    var date, err, key, match, result, value;
    if (_.isNull(values) || (values === 'null')) {
      return null;
    }
    if (_.isDate(values)) {
      return values;
    }
    if (_.isArray(values)) {
      return _.map(values, JSONUtils.parse);
    }
    if (_.isObject(values)) {
      result = {};
      for (key in values) {
        value = values[key];
        result[key] = JSONUtils.parse(value);
      }
      return result;
    } else if (_.isString(values)) {
      if ((values.length >= 20) && values[values.length - 1] === 'Z') {
        date = moment.utc(values);
        if (date && date.isValid()) {
          return date.toDate();
        } else {
          return values;
        }
      }
      if (values === 'true') {
        return true;
      }
      if (values === 'false') {
        return false;
      }
      if (match = /^\"(.*)\"$/.exec(values)) {
        return match[0];
      }
      try {
        if (values = JSON.parse(values)) {
          return JSONUtils.parse(values);
        }
      } catch (_error) {
        err = _error;
      }
    }
    return values;
  };

  JSONUtils.toQuery = function(values, depth) {
    var key, result, value;
    if (depth == null) {
      depth = 0;
    }
    if (_.isNull(values)) {
      return 'null';
    }
    if (_.isArray(values)) {
      return JSON.stringify(values);
    }
    if (_.isDate(values) || values.toJSON) {
      return values.toJSON();
    }
    if (_.isObject(values)) {
      if (depth > 0) {
        return JSON.stringify(values);
      }
      result = {};
      for (key in values) {
        value = values[key];
        result[key] = JSONUtils.toQuery(value, 1);
      }
      return result;
    }
    return values;
  };

  JSONUtils.renderTemplate = function(models, template, options, callback) {
    var model, queue, results, _fn, _i, _len;
    if (arguments.length === 3) {
      callback = options;
      options = {};
    }
    if (!_.isArray(models)) {
      if (!models) {
        return callback(null, null);
      }
      if (_.isString(template)) {
        return JSONUtils.renderKey(models, template, options, callback);
      }
      if (_.isArray(template)) {
        return JSONUtils.renderKeys(models, template, options, callback);
      }
      if (_.isFunction(template)) {
        return template(models, options, callback);
      }
      return JSONUtils.renderDSL(models, template, options, callback);
    } else {
      results = [];
      queue = new Queue(1);
      _fn = function(model) {
        return queue.defer(function(callback) {
          return JSONUtils.renderTemplate(model, template, options, function(err, related_json) {
            if (err) {
              return callback(err);
            }
            results.push(related_json);
            return callback();
          });
        });
      };
      for (_i = 0, _len = models.length; _i < _len; _i++) {
        model = models[_i];
        _fn(model);
      }
      return queue.await(function(err) {
        return callback(err, err ? void 0 : results);
      });
    }
  };

  JSONUtils.renderDSL = function(model, dsl, options, callback) {
    var args, key, queue, result, _fn;
    if (arguments.length === 3) {
      callback = options;
      options = {};
    }
    queue = new Queue();
    result = {};
    _fn = function(key, args) {
      return queue.defer(function(callback) {
        var field, fn_args, query, relation, template;
        field = args.key || key;
        if (relation = model.relation(field)) {
          if (args.query) {
            query = args.query;
            template = args.template;
          } else if (args.$count) {
            query = _.clone(args);
            delete query.key;
          } else if (_.isFunction(args)) {
            template = args;
          } else if (args.template) {
            if (_.isObject(args.template) && !_.isFunction(args.template)) {
              query = args.template;
            } else {
              template = args.template;
              query = _.clone(args);
              delete query.key;
              delete query.template;
              if (_.size(query) === 0) {
                query = null;
              }
            }
          } else {
            template = _.clone(args);
            delete template.key;
          }
          if (template) {
            if (query) {
              return relation.cursor(model, field, query).toModels(function(err, models) {
                if (err) {
                  return callback(err);
                }
                return JSONUtils.renderTemplate(models, template, options, function(err, json) {
                  result[key] = json;
                  return callback(err);
                });
              });
            } else {
              return model.get(field, function(err, related_model) {
                if (err) {
                  return callback(err);
                }
                return JSONUtils.renderTemplate(related_model, template, options, function(err, json) {
                  result[key] = json;
                  return callback(err);
                });
              });
            }
          } else {
            return relation.cursor(model, field, query).toJSON(function(err, json) {
              result[key] = json;
              return callback(err);
            });
          }
        } else {
          if (key.length > 1 && key[key.length - 1] === '_') {
            key = key.slice(0, +(key.length - 2) + 1 || 9e9);
          }
          if (key === '$select') {
            if (_.isString(args)) {
              return JSONUtils.renderKey(model, args, options, function(err, json) {
                result[args] = json;
                return callback(err);
              });
            } else {
              return JSONUtils.renderKeys(model, args, options, function(err, json) {
                _.extend(result, json);
                return callback(err);
              });
            }
          } else if (_.isString(args)) {
            return JSONUtils.renderKey(model, args, options, function(err, json) {
              result[key] = json;
              return callback(err);
            });
          } else if (_.isFunction(args)) {
            return args(model, options, function(err, json) {
              result[key] = json;
              return callback(err);
            });
          } else if (_.isString(args.method)) {
            fn_args = _.isArray(args.args) ? args.args.slice() : (args.args ? [args.args] : []);
            fn_args.push(function(err, json) {
              result[key] = json;
              return callback();
            });
            return model[args.method].apply(model, fn_args);
          } else {
            console.trace("Unknown DSL action: " + key + ": ", args);
            return callback(new Error("Unknown DSL action: " + key + ": ", args));
          }
        }
      });
    };
    for (key in dsl) {
      args = dsl[key];
      _fn(key, args);
    }
    return queue.await(function(err) {
      return callback(err, err ? void 0 : result);
    });
  };

  JSONUtils.renderKeys = function(model, keys, options, callback) {
    var key, queue, result, _fn, _i, _len;
    if (arguments.length === 3) {
      callback = options;
      options = {};
    }
    result = {};
    queue = new Queue();
    _fn = function(key) {
      return queue.defer(function(callback) {
        return JSONUtils.renderKey(model, key, options, function(err, value) {
          if (err) {
            return callback(err);
          }
          result[key] = value;
          return callback();
        });
      });
    };
    for (_i = 0, _len = keys.length; _i < _len; _i++) {
      key = keys[_i];
      _fn(key);
    }
    return queue.await(function(err) {
      return callback(err, err ? void 0 : result);
    });
  };

  JSONUtils.renderKey = function(model, key, options, callback) {
    if (arguments.length === 3) {
      callback = options;
      options = {};
    }
    return model.get(key, function(err, value) {
      var item;
      if (err) {
        return callback(err);
      }
      if (model.relation(key)) {
        if (_.isArray(value)) {
          return callback(null, (function() {
            var _i, _len, _results;
            _results = [];
            for (_i = 0, _len = value.length; _i < _len; _i++) {
              item = value[_i];
              _results.push(item.toJSON());
            }
            return _results;
          })());
        }
        if (value && value.toJSON) {
          return callback(null, value = value.toJSON());
        }
      }
      return callback(null, value);
    });
  };

  JSONUtils.renderRelated = function(models, attribute_name, template, options, callback) {
    var model, queue, results, _fn, _i, _len;
    if (arguments.length === 4) {
      callback = options;
      options = {};
    }
    if (!_.isArray(models)) {
      return models.get(attribute_name, function(err, related_models) {
        if (err) {
          callback(err);
        }
        return JSONUtils.renderTemplate(related_models, template, options, callback);
      });
    } else {
      results = [];
      queue = new Queue();
      _fn = function(model) {
        return queue.defer(function(callback) {
          return model.get(attribute_name, function(err, related_models) {
            if (err) {
              callback(err);
            }
            return JSONUtils.renderTemplate(related_models, template, options, function(err, related_json) {
              if (err) {
                return callback(err);
              }
              results.push(related_json);
              return callback();
            });
          });
        });
      };
      for (_i = 0, _len = models.length; _i < _len; _i++) {
        model = models[_i];
        _fn(model);
      }
      return queue.await(function(err) {
        return callback(err, err ? void 0 : results);
      });
    }
  };

  JSONUtils.deepClone = function(obj, depth) {
    var clone, key;
    if (!obj || (typeof obj !== 'object')) {
      return obj;
    }
    if (_.isString(obj)) {
      return String.prototype.slice.call(obj);
    }
    if (_.isDate(obj)) {
      return new Date(obj.valueOf());
    }
    if (_.isFunction(obj.clone)) {
      return obj.clone();
    }
    if (_.isArray(obj)) {
      clone = Array.prototype.slice.call(obj);
    } else if (obj.constructor !== {}.constructor) {
      return obj;
    } else {
      clone = _.extend({}, obj);
    }
    if (!_.isUndefined(depth) && (depth > 0)) {
      for (key in clone) {
        clone[key] = JSONUtils.deepClone(clone[key], depth - 1);
      }
    }
    return clone;
  };

  return JSONUtils;

}).call(this);
