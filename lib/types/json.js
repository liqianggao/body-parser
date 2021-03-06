/*!
 * body-parser
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var bytes = require('bytes')
var contentType = require('content-type')
var debug = require('debug')('body-parser:json')
var read = require('../read')
var typeis = require('type-is')

/**
 * Module exports.
 */

module.exports = json

/**
 * RegExp to match the first non-space in a string.
 *
 * Allowed whitespace is defined in RFC 7159:
 *
 *    ws = *(
 *            %x20 /              ; Space
 *            %x09 /              ; Horizontal tab
 *            %x0A /              ; Line feed or New line
 *            %x0D )              ; Carriage return
 */

var firstcharRegExp = /^[\x20\x09\x0a\x0d]*(.)/

/**
 * Create a middleware to parse JSON bodies.
 *
 * @param {object} [options]
 * @return {function}
 * @api public
 */

function json(options) {
  options = options || {}

  var limit = typeof options.limit !== 'number'
    ? bytes(options.limit || '100kb')
    : options.limit
  var inflate = options.inflate !== false
  var reviver = options.reviver
  var strict = options.strict !== false
  var type = options.type || 'json'
  var verify = options.verify || false

  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

  // create the appropriate type checking function
  var shouldParse = typeof type !== 'function'
    ? typeChecker(type)
    : type

  function parse(body) {
    if (body.length === 0) {
      // special-case empty json body, as it's a common client-side mistake
      // TODO: maybe make this configurable or part of "strict" option
      return {}
    }

    if (strict) {
      var first = firstchar(body)

      if (first !== '{' && first !== '[') {
        debug('strict violation')
        throw new Error('invalid json')
      }
    }

    debug('parse json')
    return JSON.parse(body, reviver)
  }

  return function jsonParser(req, res, next) {
    if (req._body) {
      return debug('body already parsed'), next()
    }

    req.body = req.body || {}

    // skip requests without bodies
    if (!typeis.hasBody(req)) {
      return debug('skip empty body'), next()
    }

    debug('content-type %s', JSON.stringify(req.headers['content-type']))

    // determine if request should be parsed
    if (!shouldParse(req)) {
      return debug('skip parsing'), next()
    }

    // assert charset per RFC 7159 sec 8.1
    var charset = getCharset(req) || 'utf-8'
    if (charset.substr(0, 4) !== 'utf-') {
      var err = new Error('unsupported charset "' + charset.toUpperCase() + '"')
      err.charset = charset
      err.status = 415
      return debug('invalid charset'), next(err)
    }

    // read
    read(req, res, next, parse, debug, {
      encoding: charset,
      inflate: inflate,
      limit: limit,
      verify: verify
    })
  }
}

/**
 * Get the first non-whitespace character in a string.
 *
 * @param {string} str
 * @return {function}
 * @api public
 */


function firstchar(str) {
  var match = firstcharRegExp.exec(str)
  return match ? match[1] : ''
}

/**
 * Get the charset of a request.
 *
 * @param {object} req
 * @api private
 */

function getCharset(req) {
  try {
    return contentType.parse(req).parameters.charset.toLowerCase()
  } catch (e) {
    return undefined
  }
}

/**
 * Get the simple type checker.
 *
 * @param {string} type
 * @return {function}
 */

function typeChecker(type) {
  return function checkType(req) {
    return Boolean(typeis(req, type))
  }
}
