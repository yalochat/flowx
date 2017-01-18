'use strict'

let externals = {}

externals.matchRule = (rule, test, separator) => {
  const ruleArray = rule.split(separator || '.')
  const testArray = test.split(separator || '.')

  if(ruleArray.length !== testArray.length){
    return false;
  }
  
  for (var i = 0; i < ruleArray.length; i++){
    if(ruleArray[i] !== testArray[i] && ruleArray[i] !== '*'){
      return false
    }
  }
  return true
}

module.exports = externals