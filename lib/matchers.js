'use strict'

const _ = require('lodash')

const matchRule = (rule, action, separator) => {
  const ruleArray = rule.split(separator || '.')
  if (ruleArray.length > 1) {
    const testArray = action.split(separator || '.')

    if (ruleArray.length !== testArray.length) {
      return false
    }

    for (var i = 0; i < ruleArray.length; i++) {
      if (ruleArray[i] !== testArray[i] && ruleArray[i] !== '*') {
        return false
      }
    }
    return true
  }
  return rule === action
}

const matchRegExp = (rule, action) => {
  const ruleArray = rule.split('/')
  let exp = {}

  if (ruleArray.length > 1) {
    exp = new RegExp(ruleArray[1], ruleArray[2])
    return exp.test(action)
  }
  /* else {
    exp = new RegExp(ruleArray[0])
  } */
  return false
}

const matchAll = (rule) => {
  return rule === '*'
}

const matchOne = (rule, action) => {
  return matchRule(rule, action) ||
  matchRegExp(rule, action) ||
  matchAll(rule)
}

const matchList = (rule, actionsList) => {
  const action = _.find(actionsList, {value: rule.when})
  if (action) {
    return (action.type === undefined || action.type === rule.type) &&
            (action.confidence === undefined || action.confidence > rule.confidence)
  }
  return false
}

module.exports = {
  matchRule,
  matchRegExp,
  matchAll,
  matchOne,
  matchList
}
