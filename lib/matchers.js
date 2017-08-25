'use strict'

const matchRule = (rule, test, separator) => {
  const ruleArray = rule.split(separator || '.')
  if (ruleArray.length > 1) {
    const testArray = test.split(separator || '.')

    if (ruleArray.length !== testArray.length) {
      return false;
    }

    for (var i = 0; i < ruleArray.length; i++) {
      if (ruleArray[i] !== testArray[i] && ruleArray[i] !== '*') {
        return false
      }
    }
    return true
  } else {
    return rule === test
  }
}

const matchRegExp = (rule, test) => {
  const ruleArray = rule.split('/')
  let exp = {}
  console.log(JSON.stringify(ruleArray))
  if (ruleArray.length > 1) {
    exp = new RegExp(ruleArray[1], ruleArray[2])
  } else {
    exp = new RegExp(ruleArray[0])
  }
  return exp.test(test)
}

const matchAll = (rule) => {
  return rule === '*'
}

module.exports = {
  matchRule,
  matchRegExp,
  matchAll
}