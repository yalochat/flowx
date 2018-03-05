'use strict'

const matchRule = (rule, action, separator) => {
  /* const ruleArray = rule.split(separator || '.')
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
  } */
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
  for (var i = 0; i < actionsList.length; i++) {
    if (matchOne(rule.when, actionsList[i].value)) {
      if ((rule.type === undefined && actionsList[i].type === undefined) || actionsList[i].type === rule.type) &&
      ((rule.confidence === undefined && actionsList[i].confidence === undefined) || actionsList[i].confidence > rule.confidence) {
        return true
      }
    }
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
