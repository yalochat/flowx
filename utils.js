'use strict'

module.exports.matchRule = (rule, test, separator) => {
  const ruleArray = rule.split(separator || '.')
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
}

module.exports.matchRegExp = (rule, test) => {
  const ruleArray = rule.split('/')
  let exp = {}
  console.log(JSON.stringify(ruleArray))
  if (ruleArray.length > 2) {
    exp = new RegExp(ruleArray[1], ruleArray[2])
  } else {
    exp = new RegExp(ruleArray[1])
  }
  return exp.test(test)
}
